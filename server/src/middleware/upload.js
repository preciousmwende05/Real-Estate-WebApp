const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'properties');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // random file names: never trust the client's file name
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype]),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPG, PNG or WEBP images are allowed'));
  },
});

/** Delete a previously uploaded image (seed images are never deleted). */
function removeUploadedImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/properties/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(imageUrl));
  fs.unlink(file, () => {});
}

module.exports = { upload, removeUploadedImage };
