const pool = require('../config/db');
const { validationResult } = require('express-validator');

const TYPE_LABEL = { apartment: 'Apartment', bungalow: 'Bungalow', mansion: 'Mansion' };

/** Title rule: "<n> Bedroom <Type> in <Location>"  e.g. "3 Bedroom Apartment in Kilimani" */
function buildTitle(bedrooms, propertyType, locationName) {
  return `${bedrooms} Bedroom ${TYPE_LABEL[propertyType]} in ${locationName}`;
}

/** Writes a row to activity_logs — this is what powers the admin activity feed & charts. */
async function logActivity(req, action, entityType = null, entityId = null, details = null, userId = null) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?)',
      [userId ?? req.user?.id ?? null, action, entityType, entityId, details, req.ip]
    );
  } catch (e) {
    console.error('activity log failed:', e.message); // never break the request because of logging
  }
}

/** Returns 422 with the first validation error message, if any. */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

/** Wraps async route handlers so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Loads amenities for a list of properties and attaches them as `amenities: [{id,name}]`. */
async function attachAmenities(properties) {
  if (!properties.length) return properties;
  const ids = properties.map((p) => p.id);
  const [rows] = await pool.query(
    `SELECT pa.property_id, a.id, a.name FROM property_amenities pa
     JOIN amenities a ON a.id = pa.amenity_id WHERE pa.property_id IN (?) ORDER BY a.name`,
    [ids]
  );
  const map = {};
  rows.forEach((r) => (map[r.property_id] ||= []).push({ id: r.id, name: r.name }));
  properties.forEach((p) => (p.amenities = map[p.id] || []));
  return properties;
}

module.exports = { buildTitle, logActivity, validate, asyncHandler, attachAmenities, TYPE_LABEL };
