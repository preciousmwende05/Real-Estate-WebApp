import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

const ROLES = [
  { icon: 'tag', title: 'Buy a home', text: 'Browse apartments, bungalows and mansions for sale and send offers straight to sellers.', role: 'buyer' },
  { icon: 'key', title: 'Rent a home', text: 'Find rentals that fit your budget and apply with your preferred move-in date.', role: 'renter' },
  { icon: 'home', title: 'Sell or let property', text: 'List your properties with photos, manage them in one place and respond to offers.', role: 'seller' },
];

const AREAS = ['Kilimani', 'Westlands', 'Karen', 'Lavington', 'Runda', 'Ruaka', 'Kiambu Town', 'Thika', 'Kitengela', 'Ngong', 'Syokimau', 'Juja'];

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <div className="eyebrow eyebrow-gold">Nairobi · Kiambu · Kajiado · Machakos</div>
            <h1>Find a home that feels <span className="gold">bora</span>.</h1>
            <p>Buy, rent or sell property across Nairobi and its outskirts — with smart search that understands
              “3 bedroom apartment in Kilimani under 80k with parking”.</p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-gold btn-lg">Get started</Link>
              <Link to="/login" className="btn btn-ghost-light btn-lg">I have an account</Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <img src="/uploads/seed/mansion-1.svg" alt="" />
            <div className="hero-float">
              <Icon name="sparkle" size={18} />
              <div><strong>Smart search</strong><small>Type it the way you'd say it</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">One platform, three ways in</h2>
        <p className="section-sub">Your account type decides what you see — buyers only see homes for sale, renters only see rentals.</p>
        <div className="grid-3">
          {ROLES.map((r) => (
            <div key={r.role} className="card role-card">
              <div className="role-icon"><Icon name={r.icon} size={24} /></div>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
              <Link to={`/register?role=${r.role}`} className="link-gold">Join as a {r.role} →</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="container">
          <h2 className="section-title light">Popular areas</h2>
          <div className="area-cloud">
            {AREAS.map((a) => <span key={a} className="area-chip"><Icon name="pin" size={14} />{a}</span>)}
          </div>
        </div>
      </section>
    </>
  );
}
