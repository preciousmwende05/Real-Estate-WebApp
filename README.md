# Nyumba Bora — Real Estate Web App

A responsive web app for browsing and managing property listings across **Nairobi and its outskirts**
(Kiambu, Kajiado, Machakos). Navy, white & gold theme.

| Layer | Tech | Job |
|---|---|---|
| Frontend | **React 18 + Vite** | Role-based UI, responsive layouts, admin charts (Recharts) |
| Main API | **Node.js + Express** | Auth (JWT + bcrypt), listings CRUD + photo upload, offers, favourites, admin management |
| Search & analytics | **Python Flask** | Smart, role-aware property search; market insights; admin statistics |
| Database | **MySQL** | Users, properties, amenities, offers, favourites, activity log |

```
React (5173) ──/api, /uploads──▶ Node/Express (4000) ─┐
            └──/search─────────▶ Flask (5001) ─────────┴──▶ MySQL (realestate_db)
```
Both back-ends verify the same JWT (shared `JWT_SECRET`) and re-check the user's role and status in MySQL on every request.

---

## Roles — what each user sees

| Role | Lands on | Can do |
|---|---|---|
| **Renter** | *Homes to Rent* | Sees **only rental** listings · smart search & filters · save homes · apply to rent (amount + move-in date) · track applications |
| **Buyer** | *Homes for Sale* | Sees **only for-sale** listings · smart search & filters · save homes · make purchase offers · track offers |
| **Seller** | *My Properties* | Add/edit/delete own listings **with a photo** · change status (available / under offer / sold / rented / hidden) · view & accept/decline offers and rental applications |
| **Admin** | *Dashboard* | Platform statistics & charts · manage users (suspend / reactivate / delete) · moderate all listings · full activity log |

Role rules are enforced on the **server** (Node + Flask), not just hidden in the UI — e.g. a buyer requesting a rental listing by URL gets a 404, and sellers are refused by the search API.

## Property data
- **Title** is generated automatically: `"<n> Bedroom <Apartment|Bungalow|Mansion> in <Location>"` e.g. *3 Bedroom Apartment in Kilimani*
- Short description, location (23 areas in Nairobi, Kiambu, Kajiado, Machakos), price (monthly rent **or** selling price),
  bedrooms (**1–5**, enforced in DB, API and UI), bathrooms, size, amenities (pool, gym, parking, borehole, …), **image**
- **Images:** sellers upload a JPG/PNG/WEBP (≤ 5 MB) per listing — stored in `server/uploads/properties/`.
  The demo data uses bundled illustrations in `server/uploads/seed/` (regenerate with `python database/generate_images.py`).

## Smart search
Type the way you'd say it — the Flask service turns it into filters and shows what it understood:
> *2 bedroom apartment in Kilimani under 60k with parking* · *mansion with pool between 50m and 200m* · *bungalow in Ruaka with garden*

Plus filters: locations, property type, bedrooms, price range/budget chips, amenities (must have **all**), sort, pagination.

## Security
bcrypt (12 rounds) · JWT (8h) · strong-password rule · rate-limited login/register (failed attempts) · Helmet headers ·
parameterised SQL everywhere · input validation (express-validator) · random file names + type/size checks on uploads ·
suspended users locked out immediately · admins cannot self-register · seller contact details hidden until an offer is accepted.

---

## Setup (Windows, macOS or Linux)

**Requirements:** Node.js 18+, Python 3.10+, MySQL 8 (or MariaDB 10.6+).

### 1. Database
```bash
mysql -u root -p < database/schema.sql
```

### 2. Node API
```bash
cd server
copy .env.example .env        # macOS/Linux: cp .env.example .env
# edit .env → set DB_PASSWORD and a long random JWT_SECRET
npm install
npm run seed                  # demo users + 80 properties + offers + activity
npm run dev                   # http://localhost:4000
```

### 3. Flask search service (new terminal)
```bash
cd search-service
python -m venv venv
venv\Scripts\activate         # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env        # use the SAME DB_PASSWORD and JWT_SECRET as server/.env
python app.py                 # http://localhost:5001
```

### 4. React client (new terminal)
```bash
cd client
npm install
npm run dev                   # open http://localhost:5173
```

### Demo accounts — password `Password123`
| Role | Email |
|---|---|
| Buyer | brian.buyer@nyumbabora.co.ke |
| Renter | mercy.renter@nyumbabora.co.ke |
| Seller | wanjiku.seller@nyumbabora.co.ke |
| Admin | admin@nyumbabora.co.ke |

(The login page has one-click buttons that fill these in.)

---

## API reference

**Node — `/api`**
| Method | Path | Role |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me`, `/meta` | any / public |
| GET | `/properties/:id` | any (filtered by role) |
| GET | `/properties/mine`, `/properties/mine/summary` | seller |
| POST / PUT / DELETE | `/properties`, `/properties/:id` (multipart, field `image`) | seller (own) |
| PATCH | `/properties/:id/status` | seller (own) |
| POST | `/offers` | buyer, renter |
| GET | `/offers/mine` · `/offers/received` | buyer/renter · seller |
| PATCH | `/offers/:id/respond` · `/offers/:id/withdraw` | seller · buyer/renter |
| GET / POST / DELETE | `/favorites`, `/favorites/:propertyId` | buyer, renter |
| GET / PATCH / DELETE | `/admin/users…`, `/admin/properties…`, `/admin/activity` | admin |

**Flask — `/search`**
| Method | Path | Role |
|---|---|---|
| GET | `/properties?q=&locations=&types=&bedrooms=&min_price=&max_price=&amenities=&sort=&page=` | buyer, renter, admin |
| GET | `/insights` | buyer, renter |
| GET | `/admin/stats?days=30` | admin |

## Project structure
```
database/        schema.sql, generate_images.py
server/          Express API  (src/routes, src/middleware, scripts/seed.js, uploads/)
search-service/  Flask app.py, smart_query.py
client/          React app    (src/pages/{seller,admin}, src/components, styles.css)
```

## Production notes
- Run `npm run build` in `client/` and serve `client/dist` behind a reverse proxy (nginx) that forwards `/api` + `/uploads` → 4000 and `/search` → 5001.
- Serve Flask with gunicorn/waitress, set strong secrets, and use HTTPS.
