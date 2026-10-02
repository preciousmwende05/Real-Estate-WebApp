import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PropertyImage from '../components/PropertyImage';
import { Alert, EmptyState, PageHeader, Spinner, StatusPill } from '../components/UI';
import { kes, dateShort } from '../utils/format';

export default function MyOffers() {
  const { user } = useAuth();
  const isRenter = user.role === 'renter';
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/api/offers/mine').then((r) => setOffers(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const withdraw = async (id) => {
    if (!window.confirm('Withdraw this offer?')) return;
    try { await api.patch(`/api/offers/${id}/withdraw`); load(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="container page">
      <PageHeader eyebrow={isRenter ? 'Rentals' : 'Buying'} title={isRenter ? 'My rental applications' : 'My offers'}
        subtitle={`Track every ${isRenter ? 'application' : 'offer'} you've sent. Contact details appear once accepted.`} />
      <Alert onClose={() => setError('')}>{error}</Alert>
      {!offers ? <Spinner /> : offers.length === 0 ? (
        <EmptyState icon="offer" title={`No ${isRenter ? 'applications' : 'offers'} yet`}
          action={<Link to="/browse" className="btn btn-gold">Browse homes</Link>}>
          When you find a place you like, send an {isRenter ? 'application' : 'offer'} from its page.
        </EmptyState>
      ) : (
        <div className="offer-list">
          {offers.map((o) => (
            <div key={o.id} className="card offer-row">
              <Link to={`/properties/${o.property_id}`} className="offer-thumb"><PropertyImage src={o.image_url} alt={o.title} /></Link>
              <div className="offer-main">
                <Link to={`/properties/${o.property_id}`} className="pc-title">{o.title}</Link>
                <div className="muted small">
                  Listed at {kes(o.listing_price)}{isRenter ? '/mo' : ''} · sent {dateShort(o.created_at)}
                  {o.move_in_date && <> · move-in {dateShort(o.move_in_date)}</>}
                </div>
                {o.status === 'accepted' && (
                  <div className="notice notice-success">
                    Accepted! Contact {o.seller_name}: <strong>{o.seller_phone}</strong> · {o.seller_email}
                  </div>
                )}
              </div>
              <div className="offer-side">
                <div className="offer-amount">{kes(o.amount)}</div>
                <StatusPill status={o.status} />
                {o.status === 'pending' && <button className="link-btn danger" onClick={() => withdraw(o.id)}>Withdraw</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
