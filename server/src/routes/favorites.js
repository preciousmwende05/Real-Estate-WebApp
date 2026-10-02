const router = require('express').Router();
const { param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, asyncHandler, attachAmenities } = require('../utils/helpers');

router.use(authenticate, authorize('buyer', 'renter'));
const MARKET = { buyer: 'sale', renter: 'rent' };

// GET /api/favorites — saved properties (only from the user's own market)
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, l.name AS location, l.county, 1 AS is_favorite
       FROM favorites f JOIN properties p ON p.id = f.property_id JOIN locations l ON l.id = p.location_id
      WHERE f.user_id = ? AND p.listing_type = ? AND p.status <> 'inactive' ORDER BY f.created_at DESC`,
    [req.user.id, MARKET[req.user.role]]);
  res.json(await attachAmenities(rows));
}));

router.post('/:propertyId', [param('propertyId').isInt().toInt()], validate, asyncHandler(async (req, res) => {
  const [p] = await pool.query('SELECT id FROM properties WHERE id = ? AND listing_type = ?', [req.params.propertyId, MARKET[req.user.role]]);
  if (!p.length) return res.status(404).json({ message: 'Property not found' });
  await pool.query('INSERT IGNORE INTO favorites (user_id, property_id) VALUES (?,?)', [req.user.id, req.params.propertyId]);
  res.status(201).json({ message: 'Saved' });
}));

router.delete('/:propertyId', [param('propertyId').isInt().toInt()], validate, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM favorites WHERE user_id = ? AND property_id = ?', [req.user.id, req.params.propertyId]);
  res.json({ message: 'Removed' });
}));

module.exports = router;
