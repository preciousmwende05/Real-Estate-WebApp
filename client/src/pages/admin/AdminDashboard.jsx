import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import api, { errMsg } from '../../api/client';
import { Alert, PageHeader, Spinner, StatCard } from '../../components/UI';
import { kesShort, dateTime, ROLE_LABEL, actionLabel } from '../../utils/format';

// Validated categorical palette (CVD-safe, ≥3:1 on white): blue, gold, teal — always in this order
const SERIES = { blue: '#2f6db5', gold: '#b8860b', teal: '#2a9d8f' };
const AXIS = { fontSize: 12, fill: '#5b6478' };
const GRID = '#e8ebf1';


function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tip-row">
          <span className="swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{money ? kesShort(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/search/admin/stats', { params: { days } }).then((r) => setS(r.data)).catch((e) => setError(errMsg(e)));
  }, [days]);

  if (error) return <div className="container page"><Alert>{error}</Alert></div>;
  if (!s) return <Spinner />;

  const t = s.totals;
  const role = Object.fromEntries(s.users_by_role.map((r) => [r.role, r.n]));
  const activity = s.activity.map((d) => ({ ...d, label: new Date(d.day).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) }));
  const locations = s.by_location.map((l) => ({ ...l, for_sale: Number(l.for_sale), for_rent: Number(l.for_rent) }));
  const offerTotals = s.offers.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + o.n }), {});
  const roleData = ['buyer', 'renter', 'seller'].map((r) => ({ role: ROLE_LABEL[r] + 's', users: role[r] || 0 }));

  return (
    <div className="container page">
      <PageHeader eyebrow="Administrator" title="Platform overview" subtitle="Live statistics and activity across Nyumba Bora." />

      <div className="stat-grid five">
        <StatCard icon="users" label="Users" value={t.users} hint={`+${t.new_users_week} this week${t.suspended ? ` · ${t.suspended} suspended` : ''}`} />
        <StatCard icon="home" label="Listings" value={t.properties} hint={`${t.available} available`} />
        <StatCard icon="offer" label="Offers & applications" value={t.offers} hint={`${t.pending_offers} pending · ${t.accepted_offers} accepted`} accent />
        <StatCard icon="eye" label="Listing views" value={Number(t.views).toLocaleString()} />
        <StatCard icon="tag" label="Buyers · Renters · Sellers" value={`${role.buyer || 0} · ${role.renter || 0} · ${role.seller || 0}`} />
      </div>

      <section className="card pad chart-card">
        <div className="chart-head">
          <div>
            <h3>Activity over time</h3>
            <p className="muted small">Daily logins, new listings and offers placed</p>
          </div>
          <div className="segmented">
            {[7, 30, 90].map((d) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}d</button>)}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={activity} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#9aa3b5', strokeDasharray: '3 3' }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="logins" name="Logins" stroke={SERIES.blue} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="listings" name="New listings" stroke={SERIES.gold} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="offers" name="Offers placed" stroke={SERIES.teal} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <div className="grid-2">
        <section className="card pad chart-card">
          <h3>Listings by location</h3>
          <p className="muted small">Top 10 areas · for sale vs for rent</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={locations} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="location" tick={AXIS} tickLine={false} axisLine={false} width={92} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(11,31,58,0.05)' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="for_sale" name="For sale" stackId="a" fill={SERIES.blue} stroke="#fff" strokeWidth={2} />
              <Bar dataKey="for_rent" name="For rent" stackId="a" fill={SERIES.gold} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card pad chart-card">
          <h3>Users by role</h3>
          <p className="muted small">Registered accounts (excluding admins)</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={roleData} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="role" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(11,31,58,0.05)' }} />
              <Bar dataKey="users" name="Users" fill={SERIES.blue} radius={[4, 4, 0, 0]} maxBarSize={56} label={{ position: 'top', fill: '#1b2333', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>

          <h3 className="mt">Offer outcomes</h3>
          <div className="mini-table">
            {['pending', 'accepted', 'rejected', 'withdrawn'].map((k) => (
              <div key={k}><span className={`pill pill-${k}`}>{k}</span><strong>{offerTotals[k] || 0}</strong></div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card pad">
          <h3>Average prices by area</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Location</th><th className="num">Avg rent / mo</th><th className="num">Avg sale price</th></tr></thead>
              <tbody>
                {s.by_location.map((l) => (
                  <tr key={l.location}><td>{l.location} <span className="muted small">{l.county}</span></td>
                    <td className="num">{l.avg_rent ? kesShort(l.avg_rent) : '—'}</td><td className="num">{l.avg_sale ? kesShort(l.avg_sale) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt">Most viewed listings</h3>
          <ol className="top-list">
            {s.top_viewed.map((p) => (
              <li key={p.id}><Link to={`/properties/${p.id}`}>{p.title}</Link><span className="muted small">{p.views.toLocaleString()} views</span></li>
            ))}
          </ol>
        </section>

        <section className="card pad">
          <div className="chart-head">
            <h3>Recent activity</h3>
            <Link to="/admin/activity" className="link-gold small">View all →</Link>
          </div>
          <ul className="feed">
            {s.recent.map((a, i) => (
              <li key={i}>
                <span className={`feed-dot dot-${(a.role || 'system')}`} />
                <div>
                  <strong>{a.full_name || 'System'}</strong> <span className="muted">{actionLabel(a.action).toLowerCase()}</span>
                  {a.details && <div className="small muted">{a.details}</div>}
                </div>
                <time className="small muted">{dateTime(a.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
