require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const multer = require('multer');
const pool = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or too short. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

// Property images (seed illustrations + seller uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'node-api' }));

// Public reference data for forms & filters
app.get('/api/meta', async (req, res, next) => {
  try {
    const [locations] = await pool.query("SELECT id, name, county FROM locations ORDER BY county = 'Nairobi' DESC, county, name");
    const [amenities] = await pool.query('SELECT id, name FROM amenities ORDER BY name');
    res.json({ locations, amenities, property_types: ['apartment', 'bungalow', 'mansion'] });
  } catch (e) { next(e); }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));

// Central error handler — no stack traces leak to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.field || err.message;
    return res.status(400).json({ message: msg });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Node API running on http://localhost:${PORT}`));
