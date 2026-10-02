export const kes = (n) => (n == null ? '—' : 'KES ' + Number(n).toLocaleString('en-KE', { maximumFractionDigits: 0 }));

/** Compact money for cards/axes: KES 85K, KES 12.5M */
export const kesShort = (n) => {
  if (n == null) return '—';
  const v = Number(n);
  if (v >= 1e6) return `KES ${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `KES ${Math.round(v / 1e3)}K`;
  return `KES ${v}`;
};

export const priceLabel = (p) => (p.listing_type === 'rent' ? `${kes(p.price)} / month` : kes(p.price));

export const dateShort = (d) => (d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

export const ROLE_LABEL = { buyer: 'Buyer', renter: 'Renter', seller: 'Seller', admin: 'Administrator' };

const ACTION_LABEL = {
  REGISTER: 'Registered', LOGIN: 'Logged in', LISTING_CREATED: 'Created listing', LISTING_UPDATED: 'Updated listing',
  LISTING_DELETED: 'Deleted listing', LISTING_STATUS: 'Changed listing status', OFFER_PLACED: 'Placed an offer',
  RENTAL_APPLICATION: 'Applied to rent', OFFER_ACCEPTED: 'Accepted an offer', OFFER_REJECTED: 'Declined an offer',
  OFFER_WITHDRAWN: 'Withdrew an offer', USER_SUSPENDED: 'Suspended a user', USER_REACTIVATED: 'Reactivated a user',
  USER_DELETED: 'Deleted a user', ADMIN_LISTING_STATUS: 'Moderated a listing', ADMIN_LISTING_DELETED: 'Removed a listing',
};
export const actionLabel = (a) => ACTION_LABEL[a] || cap(a.toLowerCase());
