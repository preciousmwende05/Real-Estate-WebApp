import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import PropertyImage from '../components/PropertyImage';
import { Alert, EmptyState, Spinner, StatusPill } from '../components/UI';
import { kes, priceLabel, cap, dateShort } from '../utils/format';

export default function PropertyDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [offer, setOffer] = useState({ amount: '', message: '', move_in_date: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');

  const isRenter = user.role === 'renter';
  const canOffer = ['buyer', 'renter'].includes(user.role);

  const load = () =>
    api.get(`/api/properties/${id}`)
      .then((r) => { setP(r.data); setOffer((o) => ({ ...o, amount: o.amount || r.data.price })); })
      .catch((err) => (err.response?.status === 404 ? setNotFound(true) : setError(errMsg(err))));

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitOffer = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const { data } = await api.post('/api/offers', { property_id: p.id, ...offer, amount: Number(offer.amount) });
      setSuccess(data.message);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSending(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      if (p.is_favorite) await api.delete(`/api/favorites/${p.id}`);
      else await api.post(`/api/favorites/${p.id}`);
      setP({ ...p, is_favorite: !p.is_favorite });
    } catch (err) { setError(errMsg(err)); }
  };

  if (notFound) {
    return (
      <div className="container page">
        <EmptyState icon="home" title="Property not available" action={<Link className="btn btn-navy" to="/">Go back</Link>}>
          This listing doesn't exist or isn't part of your {isRenter ? 'rental' : 'buying'} market.
        </EmptyState>
      </div>
    );
  }
  if (!p) return <Spinner />;

  const minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const pending = p.my_offer?.status === 'pending';

  return (
    <div className="container page">
      <Link to={user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin/listings' : '/browse'} className="back-link">← Back</Link>

      <div className="details-layout">
        <div>
          <div className="details-image">
            <PropertyImage src={p.image_url} alt={p.title} />
            <span className={`badge badge-${p.listing_type}`}>{p.listing_type === 'rent' ? 'For Rent' : 'For Sale'}</span>
          </div>

          <div className="details-head">
            <div>
              <h1>{p.title}</h1>
              <div className="pc-location"><Icon name="pin" size={16} />{p.location}, {p.county} County</div>
            </div>
            {canOffer && (
              <button className={`fav-btn static ${p.is_favorite ? 'active' : ''}`} onClick={toggleFavorite} aria-label="Save">
                <Icon name="heart" size={20} fill={p.is_favorite ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>

          <div className="fact-row">
            <div><Icon name="bed" /><strong>{p.bedrooms}</strong><span>Bedrooms</span></div>
            <div><Icon name="bath" /><strong>{p.bathrooms}</strong><span>Bathrooms</span></div>
            <div><Icon name="area" /><strong>{p.size_sqm || '—'}</strong><span>m²</span></div>
            <div><Icon name="home" /><strong>{cap(p.property_type)}</strong><span>Type</span></div>
          </div>

          <section className="card pad">
            <h3>About this home</h3>
            <p>{p.description}</p>
            <h3>Amenities</h3>
            {p.amenities.length ? (
              <div className="amenity-grid">
                {p.amenities.map((a) => <span key={a.id}><Icon name="check" size={16} className="gold" />{a.name}</span>)}
              </div>
            ) : <p className="muted">No amenities listed.</p>}
          </section>
        </div>

        <aside className="details-side">
          <div className="card pad price-card">
            <div className="muted">{isRenter || p.listing_type === 'rent' ? 'Monthly rent' : 'Asking price'}</div>
            <div className="big-price">{priceLabel(p)}</div>
            <div className="muted small">Listed {dateShort(p.created_at)} · <StatusPill status={p.status} /></div>
          </div>

          {canOffer && (
            <div className="card pad">
              <h3>{isRenter ? 'Apply to rent' : 'Make an offer'}</h3>
              <Alert type="success">{success}</Alert>
              <Alert onClose={() => setError('')}>{error}</Alert>
              {pending ? (
                <div className="notice">
                  You {isRenter ? 'applied' : 'offered'} <strong>{kes(p.my_offer.amount)}</strong> on {dateShort(p.my_offer.created_at)}.
                  The {isRenter ? 'landlord' : 'seller'} will respond soon. <Link to="/my-offers" className="link-gold">Track it →</Link>
                </div>
              ) : p.status === 'available' || p.status === 'under_offer' ? (
                <form onSubmit={submitOffer}>
                  <label className="field">
                    <span>{isRenter ? 'Monthly rent you will pay (KES)' : 'Your offer (KES)'}</span>
                    <input type="number" min="1000" required value={offer.amount} onChange={(e) => setOffer({ ...offer, amount: e.target.value })} />
                  </label>
                  {isRenter && (
                    <label className="field">
                      <span>Preferred move-in date</span>
                      <input type="date" min={minDate} required value={offer.move_in_date} onChange={(e) => setOffer({ ...offer, move_in_date: e.target.value })} />
                    </label>
                  )}
                  <label className="field">
                    <span>Message (optional)</span>
                    <textarea rows={3} maxLength={500} value={offer.message} onChange={(e) => setOffer({ ...offer, message: e.target.value })}
                      placeholder={isRenter ? 'Tell the landlord a little about yourself' : 'e.g. I can pay a 10% deposit this month'} />
                  </label>
                  <button className="btn btn-gold btn-block" disabled={sending}>{sending ? 'Sending…' : isRenter ? 'Send application' : 'Send offer'}</button>
                </form>
              ) : <p className="muted">This property is no longer taking {isRenter ? 'applications' : 'offers'}.</p>}
            </div>
          )}

          {user.role === 'seller' && (
            <div className="card pad">
              <h3>Your listing</h3>
              <p className="muted">{p.views} views · {p.pending_offers} pending offers</p>
              <Link className="btn btn-navy btn-block" to={`/seller/listings/${p.id}/edit`}><Icon name="edit" size={16} /> Edit listing</Link>
            </div>
          )}

          {user.role === 'admin' && (
            <div className="card pad">
              <h3>Listed by</h3>
              <p>{p.seller_name}<br /><span className="muted">{p.seller_email} · {p.seller_phone}</span></p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
