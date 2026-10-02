import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import PropertyImage from '../../components/PropertyImage';
import { Alert, PageHeader, Spinner } from '../../components/UI';
import { kes, dateShort, cap } from '../../utils/format';

export default function AdminListings() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ listing_type: '', status: '', q: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.get('/api/admin/properties', { params: { ...f, q: f.q || undefined } })
    .then((r) => setRows(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [f.listing_type, f.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (p, status) => {
    try { await api.patch(`/api/admin/properties/${p.id}/status`, { status }); setNotice('Listing updated'); load(); }
    catch (e) { setError(errMsg(e)); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Remove “${p.title}” permanently?`)) return;
    try { await api.delete(`/api/admin/properties/${p.id}`); setNotice('Listing removed'); load(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="container page">
      <PageHeader eyebrow="Administrator" title="All listings" subtitle="Moderate listings across every seller." />
      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Search title or seller" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select value={f.listing_type} onChange={(e) => setF({ ...f, listing_type: e.target.value })} aria-label="Listing type">
          <option value="">Sale & rent</option><option value="sale">For sale</option><option value="rent">For rent</option>
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          {['available', 'under_offer', 'sold', 'rented', 'inactive'].map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        <button className="btn btn-navy btn-sm">Search</button>
      </form>

      {!rows ? <Spinner /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Property</th><th>Seller</th><th className="num">Price</th><th className="num">Views</th><th className="num">Offers</th><th>Listed</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-prop">
                      <PropertyImage src={p.image_url} alt="" className="table-thumb" />
                      <div><Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link>
                        <div className="small muted">{p.listing_type === 'rent' ? 'For rent' : 'For sale'}</div></div>
                    </div>
                  </td>
                  <td>{p.seller_name}</td>
                  <td className="num">{kes(p.price)}</td>
                  <td className="num">{p.views}</td>
                  <td className="num">{p.offers}</td>
                  <td>{dateShort(p.created_at)}</td>
                  <td>
                    <select className="select-sm" value={p.status} onChange={(e) => setStatus(p, e.target.value)} aria-label="Status">
                      {['available', 'under_offer', 'sold', 'rented', 'inactive'].map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                    </select>
                  </td>
                  <td><button className="btn btn-danger btn-xs" onClick={() => remove(p)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
