import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PropertyCard from '../../components/PropertyCard';
import Icon from '../../components/Icon';
import { Alert, EmptyState, PageHeader, Spinner, StatCard } from '../../components/UI';

const TABS = [['all', 'All'], ['sale', 'For sale'], ['rent', 'For rent'], ['closed', 'Sold / Rented']];

export default function SellerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    api.get('/api/properties/mine').then((r) => setListings(r.data)).catch((e) => setError(errMsg(e)));
    api.get('/api/properties/mine/summary').then((r) => setSummary(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const changeStatus = async (p, status) => {
    try {
      await api.patch(`/api/properties/${p.id}/status`, { status });
      setNotice(`“${p.title}” marked as ${status.replace('_', ' ')}`);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.title}”? This also removes its offers.`)) return;
    try {
      await api.delete(`/api/properties/${p.id}`);
      setNotice('Listing deleted');
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const shown = (listings || []).filter((p) =>
    tab === 'all' ? true : tab === 'closed' ? ['sold', 'rented'].includes(p.status) : p.listing_type === tab);

  return (
    <div className="container page">
      <PageHeader
        eyebrow="Seller dashboard"
        title={`Karibu, ${user.full_name.split(' ')[0]}`}
        subtitle="Manage your properties and respond to buyers and renters."
        actions={<Link to="/seller/listings/new" className="btn btn-gold"><Icon name="plus" size={16} /> Add listing</Link>}
      />

      {summary && (
        <div className="stat-grid">
          <StatCard icon="home" label="Listings" value={summary.total} hint={`${summary.available} available`} />
          <StatCard icon="offer" label="Pending offers" value={summary.pending_offers} hint={`${summary.total_offers} received in total`} accent />
          <StatCard icon="check" label="Sold / rented" value={summary.closed} />
          <StatCard icon="eye" label="Total views" value={summary.views.toLocaleString()} />
        </div>
      )}

      {summary?.pending_offers > 0 && (
        <Link to="/seller/offers" className="banner-link">
          <Icon name="offer" />
          <span>You have <strong>{summary.pending_offers}</strong> offer{summary.pending_offers > 1 ? 's' : ''} waiting for a response →</span>
        </Link>
      )}

      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      <div className="tabs">
        {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {!listings ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon="home" title="No listings here yet" action={<Link to="/seller/listings/new" className="btn btn-gold">Add your first listing</Link>}>
          Add a property with a photo, price and amenities — it goes live for buyers or renters immediately.
        </EmptyState>
      ) : (
        <div className="property-grid wide">
          {shown.map((p) => (
            <PropertyCard key={p.id} p={p} footer={
              <div className="manage-bar">
                <div className="manage-meta">
                  <span><Icon name="eye" size={14} /> {p.views}</span>
                  <span className={p.pending_offers ? 'gold-text' : ''}><Icon name="offer" size={14} /> {p.pending_offers} pending</span>
                </div>
                <div className="manage-actions">
                  <select value={p.status} onChange={(e) => changeStatus(p, e.target.value)} aria-label="Listing status">
                    <option value="available">Available</option>
                    {p.listing_type === 'sale' && <option value="under_offer">Under offer</option>}
                    {p.listing_type === 'sale' ? <option value="sold">Sold</option> : <option value="rented">Rented</option>}
                    <option value="inactive">Hidden</option>
                  </select>
                  <Link className="icon-btn" to={`/seller/listings/${p.id}/edit`} title="Edit"><Icon name="edit" size={16} /></Link>
                  <button className="icon-btn danger" onClick={() => remove(p)} title="Delete"><Icon name="trash" size={16} /></button>
                </div>
              </div>
            } />
          ))}
        </div>
      )}
    </div>
  );
}
