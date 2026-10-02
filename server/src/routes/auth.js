const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, asyncHandler, logActivity } = require('../utils/helpers');

// Brute-force protection: max 10 FAILED login/register attempts per 15 min per IP
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' } });

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

const publicUser = (u) => ({ id: u.id, full_name: u.full_name, email: u.email, phone: u.phone, role: u.role });

// POST /api/auth/register  — admins cannot self-register
router.post(
  '/register',
  authLimiter,
  [
    body('full_name').trim().isLength({ min: 3, max: 120 }).withMessage('Full name must be 3–120 characters'),
    body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).trim()
      .matches(/^(\+254|0)[17]\d{8}$/).withMessage('Enter a valid Kenyan phone number e.g. 0712345678'),
    body('password').isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
      .withMessage('Password needs 8+ characters with upper-case, lower-case and a number'),
    body('role').isIn(['buyer', 'renter', 'seller']).withMessage('Choose a valid account type'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { full_name, email, phone, password, role } = req.body;
    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(409).json({ message: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
      [full_name, email, phone || null, hash, role]
    );
    const user = { id: result.insertId, full_name, email, phone: phone || null, role };
    await logActivity(req, 'REGISTER', 'user', user.id, `New ${role} account`, user.id);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail(),
   body('password').notEmpty().withMessage('Password is required')],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    // Same message for unknown email / wrong password so attackers can't enumerate accounts
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Incorrect email or password' });
    }
    if (user.status !== 'active') return res.status(403).json({ message: 'Account suspended. Contact the administrator.' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await logActivity(req, 'LOGIN', 'user', user.id, null, user.id);
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// GET /api/auth/me — used by the React app to restore a session
router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
