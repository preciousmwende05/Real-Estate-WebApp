const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * authenticate — verifies the Bearer JWT and re-checks the user in the DB,
 * so a suspended or deleted account is locked out immediately (not only when the token expires).
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, full_name, email, phone, role, status FROM users WHERE id = ?',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Account suspended. Contact the administrator.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

/** authorize('seller', 'admin') — role-based access control gate. */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
