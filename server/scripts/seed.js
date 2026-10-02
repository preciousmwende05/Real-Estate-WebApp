/**
 * Seeds demo users, ~80 properties, offers, favourites and 30 days of activity.
 * Run AFTER database/schema.sql:   npm run seed
 * Every demo account uses the password:  Password123
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');
const { buildTitle } = require('../src/utils/helpers');

// deterministic pseudo-random so every machine gets the same demo data
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const daysAgo = (d, h = between(7, 21)) => {
  const t = new Date(Date.now() - d * 86400000);
  t.setHours(h, between(0, 59), 0, 0);
  return t;
};

const USERS = [
  ['System Admin', 'admin@nyumbabora.co.ke', '0700000001', 'admin'],
  ['Wanjiku Kamau', 'wanjiku.seller@nyumbabora.co.ke', '0711000001', 'seller'],
  ['Otieno Properties Ltd', 'otieno.seller@nyumbabora.co.ke', '0711000002', 'seller'],
  ['Achieng Realty', 'achieng.seller@nyumbabora.co.ke', '0711000003', 'seller'],
  ['Kiprop Homes', 'kiprop.seller@nyumbabora.co.ke', '0711000004', 'seller'],
  ['Brian Mwangi', 'brian.buyer@nyumbabora.co.ke', '0722000001', 'buyer'],
  ['Faith Njeri', 'faith.buyer@nyumbabora.co.ke', '0722000002', 'buyer'],
  ['Hassan Ali', 'hassan.buyer@nyumbabora.co.ke', '0722000003', 'buyer'],
  ['Mercy Atieno', 'mercy.renter@nyumbabora.co.ke', '0733000001', 'renter'],
  ['Kevin Odhiambo', 'kevin.renter@nyumbabora.co.ke', '0733000002', 'renter'],
  ['Grace Wambui', 'grace.renter@nyumbabora.co.ke', '0733000003', 'renter'],
];

const PREMIUM = ['Karen', 'Runda', 'Muthaiga', 'Lavington', 'Westlands', 'Kilimani', 'Kileleshwa'];
const MID = ['Parklands', 'Langata', 'South B', 'Ruaka', 'Syokimau', 'Kiambu Town', 'Limuru', 'Ngong'];
const tier = (loc) => (PREMIUM.includes(loc) ? 1.8 : MID.includes(loc) ? 1.0 : 0.65);

const BEDS = { apartment: [1, 4], bungalow: [2, 5], mansion: [4, 5] };
const DESCRIPTIONS = {
  apartment: [
    'Modern apartment with an open-plan kitchen, spacious living area and great natural light. Close to shopping malls and public transport.',
    'Well-finished unit in a secure gated block with ample parking, a lift and reliable water supply. Ideal for young professionals and families.',
    'Bright corner apartment with a large balcony overlooking the city, master en-suite and fitted wardrobes.',
  ],
  bungalow: [
    'Charming standalone bungalow on a quiet street with a private garden, perfect for a growing family.',
    'Spacious bungalow with a modern kitchen, cosy fireplace and a large compound with room to expand.',
    'Single-storey family home in a serene gated community, with secure parking and mature trees.',
  ],
  mansion: [
    'Luxurious mansion on a half-acre with landscaped gardens, a heated pool and staff quarters. Exceptional finishes throughout.',
    'Grand family residence with double-volume living spaces, home cinema, wine cellar and panoramic views.',
    'Executive mansion in an exclusive neighbourhood with a private gym, swimming pool and top-tier security.',
  ],
};
const AMENITY_POOL = {
  apartment: ['Parking', '24hr Security', 'Lift', 'Backup Generator', 'Gym', 'Swimming Pool', 'Wi-Fi', 'Balcony', 'CCTV', 'Borehole'],
  bungalow: ['Parking', 'Garden', '24hr Security', 'Borehole', 'Solar Water Heating', 'Servant Quarters', 'CCTV', 'Playground'],
  mansion: ['Swimming Pool', 'Garden', 'Gym', 'Servant Quarters', '24hr Security', 'Borehole', 'Backup Generator', 'CCTV', 'Wi-Fi', 'Solar Water Heating'],
};

function priceFor(type, listing, beds, loc) {
  const t = tier(loc);
  if (listing === 'rent') {
    const base = { apartment: 18000 + beds * 14000, bungalow: 30000 + beds * 20000, mansion: 150000 + beds * 60000 }[type];
    return Math.round((base * t * (0.9 + rnd() * 0.25)) / 1000) * 1000;
  }
  const base = { apartment: 3500000 + beds * 3200000, bungalow: 6000000 + beds * 4500000, mansion: 40000000 + beds * 15000000 }[type];
  return Math.round((base * t * (0.9 + rnd() * 0.25)) / 100000) * 100000;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('Clearing old demo data…');
    for (const t of ['activity_logs', 'favorites', 'offers', 'property_amenities', 'properties', 'users']) {
      await conn.query(`DELETE FROM ${t}`);
    }

    const hash = await bcrypt.hash('Password123', 12);
    const ids = { admin: [], seller: [], buyer: [], renter: [] };
    for (const [name, email, phone, role] of USERS) {
      const created = daysAgo(between(20, 45));
      const [r] = await conn.query(
        'INSERT INTO users (full_name, email, phone, password_hash, role, created_at, last_login) VALUES (?,?,?,?,?,?,?)',
        [name, email, phone, hash, role, created, daysAgo(between(0, 3))]);
      ids[role].push(r.insertId);
      await conn.query("INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, 'REGISTER', 'user', ?, ?, ?)",
        [r.insertId, r.insertId, `New ${role} account`, created]);
    }

    const [locations] = await conn.query('SELECT id, name FROM locations');
    const [amenities] = await conn.query('SELECT id, name FROM amenities');
    const amenityId = Object.fromEntries(amenities.map((a) => [a.name, a.id]));

    console.log('Creating properties…');
    const props = [];
    for (let i = 0; i < 80; i++) {
      const type = pick(['apartment', 'apartment', 'apartment', 'bungalow', 'bungalow', 'mansion']);
      let loc = pick(locations);
      if (type === 'mansion' && tier(loc.name) < 1) { const prem = pick(PREMIUM); loc = locations.find((l) => l.name === prem); }
      const listing = i % 2 === 0 ? 'rent' : 'sale';
      const beds = between(...BEDS[type]);
      const price = priceFor(type, listing, beds, loc.name);
      const created = daysAgo(between(0, 30));
      const status = rnd() < 0.85 ? 'available' : listing === 'rent' ? 'rented' : 'sold';
      const sellerId = pick(ids.seller);
      const [r] = await conn.query(
        `INSERT INTO properties (seller_id, title, description, property_type, listing_type, bedrooms, bathrooms,
                                 location_id, price, size_sqm, image_url, status, views, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sellerId, buildTitle(beds, type, loc.name), pick(DESCRIPTIONS[type]), type, listing, beds,
         Math.max(1, beds - between(0, 1)), loc.id, price,
         { apartment: 45, bungalow: 90, mansion: 250 }[type] + beds * between(18, 35),
         `/uploads/seed/${type}-${(i % 6) + 1}.svg`, status, between(5, 400), created]);
      const chosen = [...AMENITY_POOL[type]].sort(() => rnd() - 0.5).slice(0, between(3, 6));
      for (const a of chosen) await conn.query('INSERT INTO property_amenities VALUES (?,?)', [r.insertId, amenityId[a]]);
      await conn.query("INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, 'LISTING_CREATED', 'property', ?, ?, ?)",
        [sellerId, r.insertId, buildTitle(beds, type, loc.name), created]);
      props.push({ id: r.insertId, listing, price, status, created, title: buildTitle(beds, type, loc.name) });
    }

    console.log('Creating offers, favourites and activity…');
    for (const p of props.filter((x) => x.status === 'available')) {
      if (rnd() < 0.45) {
        const isSale = p.listing === 'sale';
        const userId = pick(isSale ? ids.buyer : ids.renter);
        const amount = isSale ? Math.round((p.price * (0.85 + rnd() * 0.15)) / 50000) * 50000 : p.price;
        const when = daysAgo(between(0, 20));
        const moveIn = new Date(Date.now() + between(7, 60) * 86400000).toISOString().slice(0, 10);
        const status = pick(['pending', 'pending', 'pending', 'rejected', 'withdrawn']);
        await conn.query(
          'INSERT INTO offers (property_id, user_id, offer_type, amount, message, move_in_date, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
          [p.id, userId, isSale ? 'purchase' : 'rental', amount,
           isSale ? 'Very interested. Can we arrange a viewing this week?' : 'I am working nearby and would like to move in soon.',
           isSale ? null : moveIn, status, when]);
        await conn.query('INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES (?,?,?,?,?,?)',
          [userId, isSale ? 'OFFER_PLACED' : 'RENTAL_APPLICATION', 'property', p.id, `KES ${amount.toLocaleString()} on ${p.title}`, when]);
      }
      if (rnd() < 0.25) {
        const userId = pick(p.listing === 'sale' ? ids.buyer : ids.renter);
        await conn.query('INSERT IGNORE INTO favorites (user_id, property_id) VALUES (?,?)', [userId, p.id]);
      }
    }
    // Login history so the admin "activity over time" chart has shape
    const everyone = [...ids.buyer, ...ids.renter, ...ids.seller];
    for (let d = 0; d < 30; d++) {
      const n = between(2, 9);
      for (let k = 0; k < n; k++) {
        await conn.query("INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at) VALUES (?, 'LOGIN', 'user', NULL, ?)",
          [pick(everyone), daysAgo(d)]);
      }
    }
    console.log(`Done. ${USERS.length} users, ${props.length} properties.  Password for all demo accounts: Password123`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
