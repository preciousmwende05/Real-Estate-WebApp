import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { Alert, PageHeader, Spinner, StatusPill } from '../../components/UI';
import { dateShort, ROLE_LABEL } from '../../utils/format';

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.get('/api/admin/users', { params: { role, q: q || undefined } })
    .then((r) => setUsers(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (u, status) => {
    try { await api.patch(`/api/admin/users/${u.id}/status`, { status }); setNotice(`${u.full_name} ${status}`); load(); }
    catch (e) { setError(errMsg(e)); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Permanently delete ${u.full_name}? Their listings and offers are removed too.`)) return;
    try { await api.delete(`/api/admin/users/${u.id}`); setNotice('User deleted'); load(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="container page">
      <PageHeader eyebrow="Administrator" title="Users" subtitle="Suspend, reactivate or remove accounts. Suspended users are signed out immediately." />
      <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-navy btn-sm">Search</button>
      </form>

      {!users ? <Spinner /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th><th className="num">Listings</th><th className="num">Offers</th><th>Joined</th><th>Last login</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.full_name}</strong><div className="small muted">{u.email}</div></td>
                  <td><span className={`role-tag role-${u.role}`}>{ROLE_LABEL[u.role]}</span></td>
                  <td><StatusPill status={u.status} /></td>
                  <td className="num">{u.listings}</td>
                  <td className="num">{u.offers}</td>
                  <td>{dateShort(u.created_at)}</td>
                  <td>{dateShort(u.last_login)}</td>
                  <td className="row-actions">
                    {u.role !== 'admin' && (
                      <>
                        {u.status === 'active'
                          ? <button className="btn btn-outline btn-xs" onClick={() => setStatus(u, 'suspended')}>Suspend</button>
                          : <button className="btn btn-gold btn-xs" onClick={() => setStatus(u, 'active')}>Reactivate</button>}
                        <button className="btn btn-danger btn-xs" onClick={() => remove(u)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
