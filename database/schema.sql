-- =============================================================
--  Nyumba Bora Real Estate — MySQL schema
--  Run:  mysql -u root -p < database/schema.sql
-- =============================================================
DROP DATABASE IF EXISTS realestate_db;
CREATE DATABASE realestate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE realestate_db;

-- ---------- Users & roles ----------
CREATE TABLE users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(120)  NOT NULL,
  email          VARCHAR(160)  NOT NULL UNIQUE,
  phone          VARCHAR(20),
  password_hash  VARCHAR(255)  NOT NULL,
  role           ENUM('buyer','renter','seller','admin') NOT NULL,
  status         ENUM('active','suspended') NOT NULL DEFAULT 'active',
  last_login     DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- ---------- Locations (Nairobi and its outskirts) ----------
CREATE TABLE locations (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(80) NOT NULL UNIQUE,
  county  VARCHAR(40) NOT NULL
) ENGINE=InnoDB;

INSERT INTO locations (name, county) VALUES
 ('Kilimani','Nairobi'),('Westlands','Nairobi'),('Karen','Nairobi'),('Lavington','Nairobi'),
 ('Kileleshwa','Nairobi'),('Runda','Nairobi'),('Parklands','Nairobi'),('Langata','Nairobi'),
 ('South B','Nairobi'),('Kasarani','Nairobi'),('Embakasi','Nairobi'),('Muthaiga','Nairobi'),
 ('Ruaka','Kiambu'),('Kiambu Town','Kiambu'),('Thika','Kiambu'),('Juja','Kiambu'),
 ('Ruiru','Kiambu'),('Limuru','Kiambu'),('Kitengela','Kajiado'),('Ngong','Kajiado'),
 ('Ongata Rongai','Kajiado'),('Syokimau','Machakos'),('Athi River','Machakos');

-- ---------- Amenities ----------
CREATE TABLE amenities (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO amenities (name) VALUES
 ('Swimming Pool'),('Gym'),('Parking'),('Garden'),('24hr Security'),('Borehole'),
 ('Backup Generator'),('Wi-Fi'),('Balcony'),('Lift'),('CCTV'),('Servant Quarters'),
 ('Playground'),('Solar Water Heating');

-- ---------- Properties ----------
CREATE TABLE properties (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  seller_id      INT NOT NULL,
  title          VARCHAR(160) NOT NULL,          -- e.g. "3 Bedroom Apartment in Kilimani"
  description    VARCHAR(600) NOT NULL,          -- short description
  property_type  ENUM('apartment','bungalow','mansion') NOT NULL,
  listing_type   ENUM('sale','rent') NOT NULL,   -- price = monthly rent OR selling price
  bedrooms       TINYINT NOT NULL,
  bathrooms      TINYINT NOT NULL DEFAULT 1,
  location_id    INT NOT NULL,
  price          DECIMAL(14,2) NOT NULL,
  size_sqm       INT NULL,
  image_url      VARCHAR(500) NULL,
  status         ENUM('available','under_offer','sold','rented','inactive') NOT NULL DEFAULT 'available',
  views          INT NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_bedrooms CHECK (bedrooms BETWEEN 1 AND 5),
  CONSTRAINT chk_price CHECK (price > 0),
  FOREIGN KEY (seller_id)   REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id),
  INDEX idx_prop_search (listing_type, status, location_id, bedrooms, price)
) ENGINE=InnoDB;

CREATE TABLE property_amenities (
  property_id INT NOT NULL,
  amenity_id  INT NOT NULL,
  PRIMARY KEY (property_id, amenity_id),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (amenity_id)  REFERENCES amenities(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Offers (buyers) & rental applications (renters) ----------
CREATE TABLE offers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  property_id   INT NOT NULL,
  user_id       INT NOT NULL,
  offer_type    ENUM('purchase','rental') NOT NULL,
  amount        DECIMAL(14,2) NOT NULL,
  message       VARCHAR(500),
  move_in_date  DATE NULL,
  status        ENUM('pending','accepted','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_offers_property (property_id, status)
) ENGINE=InnoDB;

-- ---------- Saved / favourite properties ----------
CREATE TABLE favorites (
  user_id     INT NOT NULL,
  property_id INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, property_id),
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Activity log (feeds the admin dashboard) ----------
CREATE TABLE activity_logs (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NULL,
  action       VARCHAR(60) NOT NULL,     -- REGISTER, LOGIN, LISTING_CREATED, OFFER_PLACED ...
  entity_type  VARCHAR(30) NULL,
  entity_id    INT NULL,
  details      VARCHAR(300) NULL,
  ip_address   VARCHAR(45) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_logs_created (created_at),
  INDEX idx_logs_action (action)
) ENGINE=InnoDB;
