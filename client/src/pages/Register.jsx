import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';
import { errMsg } from '../api/client';
import { Alert } from '../components/UI';
import Icon from '../components/Icon';

const ROLE_OPTIONS = [
  { value: 'buyer', icon: 'tag', title: 'Buyer', text: 'I want to buy a home' },
  { value: 'renter', icon: 'key', title: 'Renter', text: 'I want to rent a home' },
  { value: 'seller', icon: 'home', title: 'Seller', text: 'I sell or let property' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', confirm: '',
    role: ['buyer', 'renter', 'seller'].includes(params.get('role')) ? params.get('role') : 'buyer',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      const { confirm, ...payload } = form;
      const user = await register(payload);
      navigate(HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card auth-wide card" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <p className="muted">Choose how you'll use Nyumba Bora — this decides what you see.</p>
        <Alert onClose={() => setError('')}>{error}</Alert>

        <div className="role-picker" role="radiogroup" aria-label="Account type">
          {ROLE_OPTIONS.map((r) => (
            <button type="button" key={r.value} role="radio" aria-checked={form.role === r.value}
              className={`role-option ${form.role === r.value ? 'selected' : ''}`} onClick={() => setForm({ ...form, role: r.value })}>
              <Icon name={r.icon} size={22} />
              <strong>{r.title}</strong>
              <small>{r.text}</small>
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className="field"><span>Full name</span><input required value={form.full_name} onChange={set('full_name')} autoComplete="name" /></label>
          <label className="field"><span>Phone (optional)</span><input placeholder="0712345678" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
          <label className="field span-2"><span>Email</span><input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
          <label className="field"><span>Password</span><input type="password" required value={form.password} onChange={set('password')} autoComplete="new-password" /></label>
          <label className="field"><span>Confirm password</span><input type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></label>
        </div>
        <p className="hint">At least 8 characters, with an upper-case letter, a lower-case letter and a number.</p>
        <button className="btn btn-navy btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="muted center">Already registered? <Link to="/login" className="link-gold">Log in</Link></p>
      </form>
    </div>
  );
}
