import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import PropertyImage from '../../components/PropertyImage';
import { Alert, EmptyState, PageHeader, Spinner, StatusPill } from '../../components/UI';
import { kes, dateShort } from '../../utils/format';

const FILTERS = [['pending', 'Pending'], ['purchase', 'Purchase offers'], ['rental', 'Rental applications'], ['all', 'All']];

export default function ReceivedOffers() {
  const [offers, setOffers] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.get('/api/offers/received').then((r) => setOffers(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, []);

  const respond = async (o, decision) => {
    const msg = decision === 'accepted'
      ? `Accept ${kes(o.amount)} from ${o.bidder_name}? Other pending offers on this property will be declined.`
      : `Decline the offer from ${o.bidder_name}?`;
    if (!window.confirm(msg)) return;
    try {
      await api.patch(`/api/offers/${o.id}/respond`, { decision });
      setNotice(`Offer ${decision}`);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const shown = (offers || []).filter((o) =>
    filter === 'all' ? true : filter === 'pending' ? o.status === 'pending' : o.offer_type === filter);

  return (
    <div className="container page">
      <PageHeader eyebrow="Seller dashboard" title="Offers received"
        subtitle="Purchase offers from buyers and rental applications from renters on your listings." />
      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      <div className="tabs">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {label}{k === 'pending' && offers ? ` (${offers.filter((o) => o.status === 'pending').length})` : ''}
          </button>
        ))}
      </div>

      {!offers ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon="offer" title="No offers here">Offers from buyers and renters will show up here.</EmptyState>
      ) : (
        <div className="offer-list">
          {shown.map((o) => {
            const diff = ((o.amount - o.listing_price) / o.listing_price) * 100;
            return (
              <div key={o.id} className="card offer-row">
                <Link to={`/properties/${o.property_id}`} className="offer-thumb"><PropertyImage src={o.image_url} alt={o.title} /></Link>
                <div className="offer-main">
                  <div className="offer-type">{o.offer_type === 'purchase' ? 'Purchase offer' : 'Rental application'}</div>
                  <Link to={`/properties/${o.property_id}`} className="pc-title">{o.title}</Link>
                  <div className="small"><strong>{o.bidder_name}</strong> · {o.bidder_phone || 'no phone'} · {o.bidder_email}</div>
                  <div className="muted small">
                    Sent {dateShort(o.created_at)}{o.move_in_date && <> · wants to move in {dateShort(o.move_in_date)}</>}
                  </div>
                  {o.message && <blockquote className="offer-msg">“{o.message}”</blockquote>}
                </div>
                <div className="offer-side">
                  <div className="offer-amount">{kes(o.amount)}</div>
                  <div className={`small ${diff < 0 ? 'muted' : 'gold-text'}`}>
                    {Math.abs(diff) < 0.5 ? 'At asking price' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs asking`}
                  </div>
                  <StatusPill status={o.status} />
                  {o.status === 'pending' && (
                    <div className="offer-actions">
                      <button className="btn btn-gold btn-sm" onClick={() => respond(o, 'accepted')}>Accept</button>
                      <button className="btn btn-outline btn-sm" onClick={() => respond(o, 'rejected')}>Decline</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
