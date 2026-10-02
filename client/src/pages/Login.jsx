import { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';
import { errMsg } from '../api/client';
import { Alert } from '../components/UI';

const DEMO = [
  ['Buyer', 'brian.buyer@nyumbabora.co.ke'],
  ['Renter', 'mercy.renter@nyumbabora.co.ke'],
  ['Seller', 'wanjiku.seller@nyumbabora.co.ke'],
  ['Admin', 'admin@nyumbabora.co.ke'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(params.get('expired') ? 'Your session has expired. Please log in again.' : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(location.state?.from || HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={submit} noValidate>
        <h1>Welcome back</h1>
        <p className="muted">Log in to see homes picked for your account type.</p>
        <Alert onClose={() => setError('')}>{error}</Alert>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-navy btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="muted center">New here? <Link to="/register" className="link-gold">Create an account</Link></p>

        <div className="demo-box">
          <small>Demo accounts · password <code>Password123</code></small>
          <div className="demo-buttons">
            {DEMO.map(([label, email]) => (
              <button type="button" key={label} className="chip chip-btn"
                onClick={() => setForm({ email, password: 'Password123' })}>{label}</button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
