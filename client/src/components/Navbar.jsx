import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/format';
import Icon from './Icon';

// Navigation items differ per role — this is the visible half of role-based access
const NAV = {
  buyer: [['/browse', 'Homes for Sale', 'tag'], ['/saved', 'Saved', 'heart'], ['/my-offers', 'My Offers', 'offer']],
  renter: [['/browse', 'Homes to Rent', 'key'], ['/saved', 'Saved', 'heart'], ['/my-offers', 'My Applications', 'offer']],
  seller: [['/seller', 'My Properties', 'home'], ['/seller/listings/new', 'Add Listing', 'plus'], ['/seller/offers', 'Offers Received', 'offer']],
  admin: [['/admin', 'Dashboard', 'chart'], ['/admin/users', 'Users', 'users'], ['/admin/listings', 'Listings', 'list'], ['/admin/activity', 'Activity', 'activity']],
};

export function Logo() {
  return (
    <Link to="/" className="logo">
      <img src="/favicon.svg" alt="" width="34" height="34" />
      <span>Nyumba<b>Bora</b></span>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Logo />
        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Menu"><Icon name={open ? 'x' : 'menu'} size={22} /></button>
        <nav className={`nav-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          {user ? (
            <>
              {NAV[user.role].map(([to, label, icon]) => (
                <NavLink key={to} to={to} end className="nav-link"><Icon name={icon} size={16} />{label}</NavLink>
              ))}
              <div className="nav-user">
                <span className="avatar">{user.full_name.charAt(0)}</span>
                <div className="nav-user-text">
                  <strong>{user.full_name.split(' ')[0]}</strong>
                  <small>{ROLE_LABEL[user.role]}</small>
                </div>
                <button className="btn btn-ghost-light btn-sm" onClick={doLogout} title="Log out"><Icon name="logout" size={16} /></button>
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">Log in</NavLink>
              <Link to="/register" className="btn btn-gold btn-sm">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
