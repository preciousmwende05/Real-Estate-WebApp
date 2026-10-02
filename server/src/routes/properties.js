const router = require('express').Router();
const { body, param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { upload, removeUploadedImage } = require('../middleware/upload');
const { buildTitle, logActivity, validate, asyncHandler, attachAmenities } = require('../utils/helpers');

router.use(authenticate);

const BASE_SELECT = `
  SELECT p.*, l.name AS location, l.county,
         u.full_name AS seller_name, u.email AS seller_email, u.phone AS seller_phone,
         (SELECT COUNT(*) FROM offers o WHERE o.property_id = p.id AND o.status = 'pending') AS pending_offers
  FROM properties p
  JOIN locations l ON l.id = p.location_id
  JOIN users u ON u.id = p.seller_id`;

// Which listing type each role may see
const ROLE_MARKET = { buyer: 'sale', renter: 'rent' };

/** amenities arrive as "1,3,5" (multipart) or [1,3,5] (JSON) */
function parseAmenities(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

const listingRules = [
  body('description').trim().isLength({ min: 20, max: 600 }).withMessage('Short description must be 20–600 characters'),
  body('property_type').isIn(['apartment', 'bungalow', 'mansion']).withMessage('Property type must be apartment, bungalow or mansion'),
  body('listing_type').isIn(['sale', 'rent']).withMessage('Listing type must be sale or rent'),
  body('bedrooms').isInt({ min: 1, max: 5 }).withMessage('Bedrooms must be between 1 and 5').toInt(),
  body('bathrooms').optional().isInt({ min: 1, max: 8 }).withMessage('Bathrooms must be 1–8').toInt(),
  body('location_id').isInt({ min: 1 }).withMessage('Choose a location').toInt(),
  body('price').isFloat({ min: 1000, max: 2000000000 }).withMessage('Enter a valid price in KES').toFloat(),
  body('size_sqm').optional({ checkFalsy: true }).isInt({ min: 10, max: 10000 }).withMessage('Size must be 10–10,000 m²').toInt(),
];

async function getLocationName(id) {
  const [rows] = await pool.query('SELECT name FROM locations WHERE id = ?', [id]);
  return rows[0]?.name;
}

async function saveAmenities(conn, propertyId, amenityIds) {
  await conn.query('DELETE FROM property_amenities WHERE property_id = ?', [propertyId]);
  if (amenityIds.length) {
    await conn.query('INSERT IGNORE INTO property_amenities (property_id, amenity_id) SELECT ?, id FROM amenities WHERE id IN (?)',
      [propertyId, amenityIds]);
  }
}

// ---------------- Seller: my listings ----------------
// GET /api/properties/mine
router.get('/mine', authorize('seller'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE p.seller_id = ? ORDER BY p.created_at DESC`, [req.user.id]);
  res.json(await attachAmenities(rows));
}));

// GET /api/properties/mine/summary — numbers for the seller dashboard cards
router.get('/mine/summary', authorize('seller'), asyncHandler(async (req, res) => {
  const [[s]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(status = 'available') AS available,
            SUM(status IN ('sold','rented')) AS closed,
            COALESCE(SUM(views),0) AS views
       FROM properties WHERE seller_id = ?`, [req.user.id]);
  const [[o]] = await pool.query(
    `SELECT COUNT(*) AS total_offers, SUM(o.status = 'pending') AS pending_offers
       FROM offers o JOIN properties p ON p.id = o.property_id WHERE p.seller_id = ?`, [req.user.id]);
  res.json({
    total: Number(s.total), available: Number(s.available || 0), closed: Number(s.closed || 0), views: Number(s.views),
    total_offers: Number(o.total_offers), pending_offers: Number(o.pending_offers || 0),
  });
}));

// POST /api/properties — create listing (multipart/form-data with optional "image")
router.post('/', authorize('seller'), upload.single('image'), listingRules, validate, asyncHandler(async (req, res) => {
  const { description, property_type, listing_type, bedrooms, location_id, price } = req.body;
  const bathrooms = req.body.bathrooms || 1;
  const size_sqm = req.body.size_sqm || null;
  const locationName = await getLocationName(location_id);
  if (!locationName) return res.status(422).json({ message: 'Unknown location' });

  const title = buildTitle(bedrooms, property_type, locationName);
  const image_url = req.file ? `/uploads/properties/${req.file.filename}` : `/uploads/seed/${property_type}-${1 + Math.floor(Math.random() * 6)}.svg`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO properties (seller_id, title, description, property_type, listing_type, bedrooms, bathrooms,
                               location_id, price, size_sqm, image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, title, description, property_type, listing_type, bedrooms, bathrooms, location_id, price, size_sqm, image_url]
    );
    await saveAmenities(conn, r.insertId, parseAmenities(req.body.amenities));
    await conn.commit();
    await logActivity(req, 'LISTING_CREATED', 'property', r.insertId, title);
    const [rows] = await pool.query(`${BASE_SELECT} WHERE p.id = ?`, [r.insertId]);
    res.status(201).json((await attachAmenities(rows))[0]);
  } catch (e) {
    await conn.rollback();
    if (req.file) removeUploadedImage(`/uploads/properties/${req.file.filename}`);
    throw e;
  } finally {
    conn.release();
  }
}));

// PUT /api/properties/:id — update own listing (image optional)
router.put('/:id', authorize('seller'), upload.single('image'), [param('id').isInt().toInt(), ...listingRules], validate,
  asyncHandler(async (req, res) => {
    const [own] = await pool.query('SELECT * FROM properties WHERE id = ? AND seller_id = ?', [req.params.id, req.user.id]);
    if (!own.length) return res.status(404).json({ message: 'Listing not found' });

    const { description, property_type, listing_type, bedrooms, location_id, price } = req.body;
    const locationName = await getLocationName(location_id);
    if (!locationName) return res.status(422).json({ message: 'Unknown location' });
    const title = buildTitle(bedrooms, property_type, locationName);
    const image_url = req.file ? `/uploads/properties/${req.file.filename}` : own[0].image_url;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE properties SET title=?, description=?, property_type=?, listing_type=?, bedrooms=?, bathrooms=?,
                location_id=?, price=?, size_sqm=?, image_url=? WHERE id=?`,
        [title, description, property_type, listing_type, bedrooms, req.body.bathrooms || 1, location_id, price,
         req.body.size_sqm || null, image_url, req.params.id]
      );
      await saveAmenities(conn, req.params.id, parseAmenities(req.body.amenities));
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    if (req.file) removeUploadedImage(own[0].image_url);
    await logActivity(req, 'LISTING_UPDATED', 'property', req.params.id, title);
    const [rows] = await pool.query(`${BASE_SELECT} WHERE p.id = ?`, [req.params.id]);
    res.json((await attachAmenities(rows))[0]);
  }));

// PATCH /api/properties/:id/status — seller marks available / sold / rented / inactive
router.patch('/:id/status', authorize('seller'),
  [param('id').isInt().toInt(), body('status').isIn(['available', 'under_offer', 'sold', 'rented', 'inactive']).withMessage('Invalid status')],
  validate, asyncHandler(async (req, res) => {
    const [r] = await pool.query('UPDATE properties SET status = ? WHERE id = ? AND seller_id = ?',
      [req.body.status, req.params.id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Listing not found' });
    await logActivity(req, 'LISTING_STATUS', 'property', req.params.id, `Status → ${req.body.status}`);
    res.json({ message: 'Status updated' });
  }));

// DELETE /api/properties/:id
router.delete('/:id', authorize('seller'), [param('id').isInt().toInt()], validate, asyncHandler(async (req, res) => {
  const [own] = await pool.query('SELECT image_url, title FROM properties WHERE id = ? AND seller_id = ?', [req.params.id, req.user.id]);
  if (!own.length) return res.status(404).json({ message: 'Listing not found' });
  await pool.query('DELETE FROM properties WHERE id = ?', [req.params.id]);
  removeUploadedImage(own[0].image_url);
  await logActivity(req, 'LISTING_DELETED', 'property', req.params.id, own[0].title);
  res.json({ message: 'Listing deleted' });
}));

// ---------------- Property details (role-aware) ----------------
// GET /api/properties/:id
router.get('/:id', [param('id').isInt().toInt()], validate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE p.id = ?`, [req.params.id]);
  const p = rows[0];
  if (!p) return res.status(404).json({ message: 'Property not found' });

  const { role, id } = req.user;
  const market = ROLE_MARKET[role];
  // RBAC: buyers only see sale listings, renters only rent listings, sellers only their own
  if (market && (p.listing_type !== market || p.status === 'inactive')) return res.status(404).json({ message: 'Property not found' });
  if (role === 'seller' && p.seller_id !== id) return res.status(404).json({ message: 'Property not found' });

  if (market) {
    await pool.query('UPDATE properties SET views = views + 1 WHERE id = ?', [p.id]);
    const [fav] = await pool.query('SELECT 1 FROM favorites WHERE user_id = ? AND property_id = ?', [id, p.id]);
    const [myOffer] = await pool.query(
      `SELECT id, amount, status, created_at FROM offers WHERE user_id = ? AND property_id = ? ORDER BY created_at DESC LIMIT 1`, [id, p.id]);
    p.is_favorite = fav.length > 0;
    p.my_offer = myOffer[0] || null;
  }
  res.json((await attachAmenities([p]))[0]);
}));

module.exports = router;
