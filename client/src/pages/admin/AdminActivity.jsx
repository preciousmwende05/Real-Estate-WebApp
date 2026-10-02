import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { Alert, PageHeader, Spinner } from '../../components/UI';
import { dateTime, ROLE_LABEL, actionLabel } from '../../utils/format';

const ACTIONS = ['', 'REGISTER', 'LOGIN', 'LISTING_CREATED', 'LISTING_UPDATED', 'LISTING_DELETED', 'OFFER_PLACED',
  'RENTAL_APPLICATION', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'USER_SUSPENDED', 'ADMIN_LISTING_DELETED'];

export default function AdminActivity() {
  const [rows, setRows] = useState(null);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    api.get('/api/admin/activity', { params: { action: action || undefined, limit: 200 } })
      .then((r) => setRows(r.data)).catch((e) => setError(errMsg(e)));
  }, [action]);

  return (
    <div className="container page">
      <PageHeader eyebrow="Administrator" title="Activity log" subtitle="Every sign-up, login, listing change and offer on the platform." />
      <Alert onClose={() => setError('')}>{error}</Alert>
      <div className="toolbar">
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          {ACTIONS.map((a) => <option key={a} value={a}>{a ? actionLabel(a) : 'All activity'}</option>)}
        </select>
      </div>
      {!rows ? <Spinner /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{dateTime(a.created_at)}</td>
                  <td>{a.full_name || <span className="muted">Deleted user</span>}{a.role && <div className="small muted">{ROLE_LABEL[a.role]}</div>}</td>
                  <td><span className="action-tag">{actionLabel(a.action)}</span></td>
                  <td className="small">{a.details || '—'}</td>
                  <td className="small muted">{a.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
