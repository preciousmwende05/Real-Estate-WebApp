const router = require('express').Router();
const { body, param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity, validate, asyncHandler } = require('../utils/helpers');

router.use(authenticate);

const OFFER_SELECT = `
  SELECT o.*, p.title, p.price AS listing_price, p.listing_type, p.image_url, p.status AS property_status,
         l.name AS location, b.full_name AS bidder_name, b.email AS bidder_email, b.phone AS bidder_phone,
         s.full_name AS seller_name, s.phone AS seller_phone, s.email AS seller_email
  FROM offers o
  JOIN properties p ON p.id = o.property_id
  JOIN locations l ON l.id = p.location_id
  JOIN users b ON b.id = o.user_id
  JOIN users s ON s.id = p.seller_id`;

// POST /api/offers — buyers make purchase offers; renters send rental applications
router.post('/', authorize('buyer', 'renter'),
  [
    body('property_id').isInt({ min: 1 }).toInt(),
    body('amount').isFloat({ min: 1000 }).withMessage('Enter a valid amount in KES').toFloat(),
    body('message').optional().trim().isLength({ max: 500 }).withMessage('Message is too long'),
    body('move_in_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid move-in date'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { property_id, amount, message, move_in_date } = req.body;
    const expected = req.user.role === 'buyer' ? 'sale' : 'rent';
    const [rows] = await pool.query('SELECT id, title, listing_type, status FROM properties WHERE id = ?', [property_id]);
    const p = rows[0];
    if (!p || p.listing_type !== expected) return res.status(404).json({ message: 'Property not found' });
    if (!['available', 'under_offer'].includes(p.status)) return res.status(409).json({ message: 'This property is no longer available' });
    if (req.user.role === 'renter' && !move_in_date) return res.status(422).json({ message: 'Please choose a move-in date' });

    const [dupe] = await pool.query("SELECT id FROM offers WHERE property_id = ? AND user_id = ? AND status = 'pending'",
      [property_id, req.user.id]);
    if (dupe.length) return res.status(409).json({ message: 'You already have a pending offer on this property. Withdraw it first to change it.' });

    const offerType = req.user.role === 'buyer' ? 'purchase' : 'rental';
    const [r] = await pool.query(
      'INSERT INTO offers (property_id, user_id, offer_type, amount, message, move_in_date) VALUES (?,?,?,?,?,?)',
      [property_id, req.user.id, offerType, amount, message || null, move_in_date || null]);
    await logActivity(req, offerType === 'purchase' ? 'OFFER_PLACED' : 'RENTAL_APPLICATION', 'offer', r.insertId,
      `KES ${amount.toLocaleString()} on ${p.title}`);
    res.status(201).json({ id: r.insertId, message: offerType === 'purchase' ? 'Offer sent to the seller' : 'Application sent to the landlord' });
  }));

// GET /api/offers/mine — offers I (buyer/renter) have made
router.get('/mine', authorize('buyer', 'renter'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${OFFER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC`, [req.user.id]);
  // Hide the seller's contact details until the offer is accepted
  rows.forEach((o) => { if (o.status !== 'accepted') { o.seller_phone = null; o.seller_email = null; } });
  res.json(rows);
}));

// GET /api/offers/received — offers on my listings (seller)
router.get('/received', authorize('seller'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${OFFER_SELECT} WHERE p.seller_id = ? ORDER BY (o.status = 'pending') DESC, o.created_at DESC`,
    [req.user.id]);
  res.json(rows);
}));

// PATCH /api/offers/:id/respond — seller accepts or rejects
router.patch('/:id/respond', authorize('seller'),
  [param('id').isInt().toInt(), body('decision').isIn(['accepted', 'rejected']).withMessage('Decision must be accepted or rejected')],
  validate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT o.*, p.seller_id, p.listing_type, p.title FROM offers o JOIN properties p ON p.id = o.property_id WHERE o.id = ?`,
      [req.params.id]);
    const offer = rows[0];
    if (!offer || offer.seller_id !== req.user.id) return res.status(404).json({ message: 'Offer not found' });
    if (offer.status !== 'pending') return res.status(409).json({ message: `Offer is already ${offer.status}` });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE offers SET status = ? WHERE id = ?', [req.body.decision, offer.id]);
      if (req.body.decision === 'accepted') {
        // Accepting closes the deal: rental → rented; sale → under offer (seller marks "sold" on completion).
        const newStatus = offer.listing_type === 'rent' ? 'rented' : 'under_offer';
        await conn.query('UPDATE properties SET status = ? WHERE id = ?', [newStatus, offer.property_id]);
        await conn.query("UPDATE offers SET status = 'rejected' WHERE property_id = ? AND id <> ? AND status = 'pending'",
          [offer.property_id, offer.id]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    await logActivity(req, req.body.decision === 'accepted' ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED', 'offer', offer.id, offer.title);
    res.json({ message: `Offer ${req.body.decision}` });
  }));

// PATCH /api/offers/:id/withdraw — buyer/renter withdraws their own pending offer
router.patch('/:id/withdraw', authorize('buyer', 'renter'), [param('id').isInt().toInt()], validate,
  asyncHandler(async (req, res) => {
    const [r] = await pool.query("UPDATE offers SET status = 'withdrawn' WHERE id = ? AND user_id = ? AND status = 'pending'",
      [req.params.id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'No pending offer found' });
    await logActivity(req, 'OFFER_WITHDRAWN', 'offer', req.params.id);
    res.json({ message: 'Offer withdrawn' });
  }));

module.exports = router;
