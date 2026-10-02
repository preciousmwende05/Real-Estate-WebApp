const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { removeUploadedImage } = require('../middleware/upload');
const { logActivity, validate, asyncHandler } = require('../utils/helpers');

// Every route in this file is admin-only
router.use(authenticate, authorize('admin'));

// GET /api/admin/users?role=&q=
router.get('/users', [query('role').optional().isIn(['buyer', 'renter', 'seller', 'admin', ''])], validate,
  asyncHandler(async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.role) { where.push('u.role = ?'); params.push(req.query.role); }
    if (req.query.q) { where.push('(u.full_name LIKE ? OR u.email LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at, u.last_login,
              (SELECT COUNT(*) FROM properties p WHERE p.seller_id = u.id) AS listings,
              (SELECT COUNT(*) FROM offers o WHERE o.user_id = u.id) AS offers
         FROM users u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY u.created_at DESC`, params);
    res.json(rows);
  }));

// PATCH /api/admin/users/:id/status  { status: 'active' | 'suspended' }
router.patch('/users/:id/status',
  [param('id').isInt().toInt(), body('status').isIn(['active', 'suspended']).withMessage('Invalid status')], validate,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot change your own status' });
    const [r] = await pool.query("UPDATE users SET status = ? WHERE id = ? AND role <> 'admin'", [req.body.status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'User not found (admins cannot be suspended here)' });
    await logActivity(req, req.body.status === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', 'user', req.params.id);
    res.json({ message: `User ${req.body.status}` });
  }));

// DELETE /api/admin/users/:id
router.delete('/users/:id', [param('id').isInt().toInt()], validate, asyncHandler(async (req, res) => {
  const [r] = await pool.query("DELETE FROM users WHERE id = ? AND role <> 'admin'", [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ message: 'User not found (admins cannot be deleted here)' });
  await logActivity(req, 'USER_DELETED', 'user', req.params.id);
  res.json({ message: 'User deleted' });
}));

// GET /api/admin/properties?listing_type=&status=&q=
router.get('/properties', asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  if (['sale', 'rent'].includes(req.query.listing_type)) { where.push('p.listing_type = ?'); params.push(req.query.listing_type); }
  if (req.query.status) { where.push('p.status = ?'); params.push(req.query.status); }
  if (req.query.q) { where.push('(p.title LIKE ? OR u.full_name LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const [rows] = await pool.query(
    `SELECT p.id, p.title, p.listing_type, p.property_type, p.price, p.status, p.views, p.image_url, p.created_at,
            l.name AS location, u.full_name AS seller_name,
            (SELECT COUNT(*) FROM offers o WHERE o.property_id = p.id) AS offers
       FROM properties p JOIN locations l ON l.id = p.location_id JOIN users u ON u.id = p.seller_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC`, params);
  res.json(rows);
}));

// PATCH /api/admin/properties/:id/status — moderation (e.g. deactivate a suspicious listing)
router.patch('/properties/:id/status',
  [param('id').isInt().toInt(), body('status').isIn(['available', 'under_offer', 'sold', 'rented', 'inactive'])], validate,
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('UPDATE properties SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Property not found' });
    await logActivity(req, 'ADMIN_LISTING_STATUS', 'property', req.params.id, `Status → ${req.body.status}`);
    res.json({ message: 'Listing updated' });
  }));

router.delete('/properties/:id', [param('id').isInt().toInt()], validate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT image_url, title FROM properties WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Property not found' });
  await pool.query('DELETE FROM properties WHERE id = ?', [req.params.id]);
  removeUploadedImage(rows[0].image_url);
  await logActivity(req, 'ADMIN_LISTING_DELETED', 'property', req.params.id, rows[0].title);
  res.json({ message: 'Listing deleted' });
}));

// GET /api/admin/activity?action=&limit=
router.get('/activity', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const params = [];
  let where = '';
  if (req.query.action) { where = 'WHERE a.action = ?'; params.push(req.query.action); }
  const [rows] = await pool.query(
    `SELECT a.*, u.full_name, u.role FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
       ${where} ORDER BY a.created_at DESC LIMIT ?`, [...params, limit]);
  res.json(rows);
}));

module.exports = router;
