"""
Nyumba Bora — Flask search & analytics service
------------------------------------------------
* GET /search/properties      smart, role-aware property search (buyers → sale, renters → rent)
* GET /search/insights        market snapshot for the user's market (avg prices per location)
* GET /search/admin/stats     statistics for the admin dashboard
Authentication: the JWT issued by the Node API (shared JWT_SECRET).
"""
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from functools import wraps

import jwt
import pymysql
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

import smart_query

load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET", "")
if len(JWT_SECRET) < 16:
    raise SystemExit("JWT_SECRET is missing or too short. Copy .env.example to .env and set it.")


class JSONProvider(DefaultJSONProvider):
    """Serialise MySQL Decimal and datetime values cleanly."""
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return super().default(o)


app = Flask(__name__)
app.json = JSONProvider(app)
CORS(app, origins=[os.getenv("CLIENT_ORIGIN", "http://localhost:5173")])

ROLE_MARKET = {"buyer": "sale", "renter": "rent"}
SORTS = {
    "newest": "p.created_at DESC",
    "price_asc": "p.price ASC",
    "price_desc": "p.price DESC",
    "popular": "p.views DESC",
    "bedrooms": "p.bedrooms DESC, p.price ASC",
}


# ---------------------------------------------------------------- helpers
def db():
    if "db" not in g:
        g.db = pymysql.connect(
            host=os.getenv("DB_HOST", "localhost"), port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER", "root"), password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "realestate_db"), cursorclass=pymysql.cursors.DictCursor, autocommit=True,
        )
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn:
        conn.close()


def query(sql, params=()):
    with db().cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def require_roles(*roles):
    """Verifies the Bearer token, re-checks the account in MySQL and enforces RBAC."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify(message="Authentication required"), 401
            try:
                payload = jwt.decode(header[7:], JWT_SECRET, algorithms=["HS256"])
            except jwt.PyJWTError:
                return jsonify(message="Invalid or expired session. Please log in again."), 401
            rows = query("SELECT id, role, status FROM users WHERE id = %s", (payload.get("sub"),))
            if not rows or rows[0]["status"] != "active":
                return jsonify(message="Account unavailable"), 403
            g.user = rows[0]
            if g.user["role"] not in roles:
                return jsonify(message="You do not have permission to perform this action"), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def int_list(name):
    raw = request.args.get(name, "")
    return [int(x) for x in raw.split(",") if x.strip().isdigit()]


def num(name):
    try:
        v = float(request.args.get(name, ""))
        return v if v >= 0 else None
    except ValueError:
        return None


# ---------------------------------------------------------------- routes
@app.get("/search/health")
def health():
    return jsonify(ok=True, service="flask-search")


@app.get("/search/properties")
@require_roles("buyer", "renter", "admin")
def search_properties():
    role = g.user["role"]
    market = ROLE_MARKET.get(role) or (request.args.get("listing_type") if request.args.get("listing_type") in ("sale", "rent") else None)

    # 1) explicit filters from the filter panel
    f = {
        "location_ids": int_list("locations"),
        "property_types": [t for t in request.args.get("types", "").split(",") if t in ("apartment", "bungalow", "mansion")],
        "amenity_ids": int_list("amenities"),
        "min_price": num("min_price"),
        "max_price": num("max_price"),
        "bedrooms": None,
        "min_bedrooms": None,
    }
    beds = request.args.get("bedrooms", "")
    if beds.isdigit() and 1 <= int(beds) <= 5:
        f["bedrooms"] = int(beds)
    min_beds = request.args.get("min_bedrooms", "")
    if min_beds.isdigit() and 1 <= int(min_beds) <= 5:
        f["min_bedrooms"] = int(min_beds)
    county = request.args.get("county", "").strip()

    # 2) smart free-text query — parsed filters are merged in (explicit filters win)
    keyword, interpreted = "", {}
    text = request.args.get("q", "").strip()[:200]
    if text:
        locations = query("SELECT id, name FROM locations")
        amenities = query("SELECT id, name FROM amenities")
        interpreted, keyword = smart_query.parse(text, locations, amenities)
        for k, v in interpreted.items():
            if isinstance(v, list):
                f[k] = f[k] or v
            elif f.get(k) is None:
                f[k] = v

    where, params = ["p.status IN ('available','under_offer')"], []
    if market:
        where.append("p.listing_type = %s"); params.append(market)
    if f["location_ids"]:
        where.append("p.location_id IN (" + ",".join(["%s"] * len(f["location_ids"])) + ")"); params += f["location_ids"]
    if county:
        where.append("l.county = %s"); params.append(county)
    if f["property_types"]:
        where.append("p.property_type IN (" + ",".join(["%s"] * len(f["property_types"])) + ")"); params += f["property_types"]
    if f["bedrooms"]:
        where.append("p.bedrooms = %s"); params.append(f["bedrooms"])
    elif f["min_bedrooms"]:
        where.append("p.bedrooms >= %s"); params.append(f["min_bedrooms"])
    if f["min_price"] is not None:
        where.append("p.price >= %s"); params.append(f["min_price"])
    if f["max_price"] is not None:
        where.append("p.price <= %s"); params.append(f["max_price"])
    if f["amenity_ids"]:
        # property must have ALL selected amenities
        where.append(
            "p.id IN (SELECT property_id FROM property_amenities WHERE amenity_id IN ("
            + ",".join(["%s"] * len(f["amenity_ids"])) + ") GROUP BY property_id HAVING COUNT(DISTINCT amenity_id) = %s)")
        params += f["amenity_ids"] + [len(f["amenity_ids"])]
    if keyword:
        like = f"%{keyword}%"
        where.append("(p.title LIKE %s OR p.description LIKE %s OR l.name LIKE %s)"); params += [like, like, like]

    order = SORTS.get(request.args.get("sort", "newest"), SORTS["newest"])
    page = max(int(request.args.get("page", 1) or 1), 1)
    size = min(max(int(request.args.get("page_size", 12) or 12), 1), 48)
    where_sql = " AND ".join(where)

    total = query(f"SELECT COUNT(*) AS n FROM properties p JOIN locations l ON l.id = p.location_id WHERE {where_sql}", params)[0]["n"]
    rows = query(
        f"""SELECT p.id, p.title, p.description, p.property_type, p.listing_type, p.bedrooms, p.bathrooms,
                   p.price, p.size_sqm, p.image_url, p.status, p.views, p.created_at, l.name AS location, l.county,
                   EXISTS(SELECT 1 FROM favorites fv WHERE fv.user_id = %s AND fv.property_id = p.id) AS is_favorite
              FROM properties p JOIN locations l ON l.id = p.location_id
             WHERE {where_sql} ORDER BY {order} LIMIT %s OFFSET %s""",
        [g.user["id"], *params, size, (page - 1) * size])

    if rows:
        ids = [r["id"] for r in rows]
        am = query("SELECT pa.property_id, a.name FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id "
                   "WHERE pa.property_id IN (" + ",".join(["%s"] * len(ids)) + ") ORDER BY a.name", ids)
        by_prop = {}
        for a in am:
            by_prop.setdefault(a["property_id"], []).append(a["name"])
        for r in rows:
            r["amenities"] = by_prop.get(r["id"], [])
            r["is_favorite"] = bool(r["is_favorite"])

    return jsonify(results=rows, total=total, page=page, page_size=size, pages=(total + size - 1) // size,
                   market=market, interpreted=interpreted, keyword=keyword)


@app.get("/search/insights")
@require_roles("buyer", "renter")
def insights():
    market = ROLE_MARKET[g.user["role"]]
    by_location = query(
        """SELECT l.name AS location, COUNT(*) AS listings, ROUND(AVG(p.price)) AS avg_price, MIN(p.price) AS min_price
             FROM properties p JOIN locations l ON l.id = p.location_id
            WHERE p.listing_type = %s AND p.status = 'available'
            GROUP BY l.name ORDER BY listings DESC LIMIT 8""", (market,))
    summary = query(
        """SELECT COUNT(*) AS available, ROUND(AVG(price)) AS avg_price, MIN(price) AS min_price,
                  SUM(created_at >= NOW() - INTERVAL 7 DAY) AS new_this_week
             FROM properties WHERE listing_type = %s AND status = 'available'""", (market,))[0]
    return jsonify(market=market, summary=summary, by_location=by_location)


@app.get("/search/admin/stats")
@require_roles("admin")
def admin_stats():
    days = min(max(int(request.args.get("days", 30) or 30), 7), 90)
    since = datetime.now() - timedelta(days=days - 1)

    users_by_role = query("SELECT role, COUNT(*) AS n FROM users GROUP BY role")
    listings = query(
        """SELECT listing_type, status, COUNT(*) AS n FROM properties GROUP BY listing_type, status""")
    by_type = query("SELECT property_type, listing_type, COUNT(*) AS n FROM properties GROUP BY property_type, listing_type")
    offers = query("SELECT offer_type, status, COUNT(*) AS n FROM offers GROUP BY offer_type, status")
    by_location = query(
        """SELECT l.name AS location, l.county, COUNT(*) AS listings,
                  SUM(p.listing_type='sale') AS for_sale, SUM(p.listing_type='rent') AS for_rent,
                  ROUND(AVG(CASE WHEN p.listing_type='rent' THEN p.price END)) AS avg_rent,
                  ROUND(AVG(CASE WHEN p.listing_type='sale' THEN p.price END)) AS avg_sale
             FROM properties p JOIN locations l ON l.id = p.location_id
            GROUP BY l.id ORDER BY listings DESC LIMIT 10""")
    daily = query(
        """SELECT DATE(created_at) AS day,
                  SUM(action='LOGIN') AS logins, SUM(action='REGISTER') AS registrations,
                  SUM(action='LISTING_CREATED') AS listings,
                  SUM(action IN ('OFFER_PLACED','RENTAL_APPLICATION')) AS offers
             FROM activity_logs WHERE created_at >= %s GROUP BY DATE(created_at) ORDER BY day""", (since.date(),))
    top_viewed = query(
        """SELECT p.id, p.title, p.listing_type, p.price, p.views, l.name AS location
             FROM properties p JOIN locations l ON l.id = p.location_id ORDER BY p.views DESC LIMIT 5""")
    recent = query(
        """SELECT a.action, a.details, a.created_at, u.full_name, u.role
             FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 12""")
    totals = query(
        """SELECT (SELECT COUNT(*) FROM users) AS users,
                  (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY) AS new_users_week,
                  (SELECT COUNT(*) FROM properties) AS properties,
                  (SELECT COUNT(*) FROM properties WHERE status='available') AS available,
                  (SELECT COUNT(*) FROM offers) AS offers,
                  (SELECT COUNT(*) FROM offers WHERE status='pending') AS pending_offers,
                  (SELECT COUNT(*) FROM offers WHERE status='accepted') AS accepted_offers,
                  (SELECT COALESCE(SUM(views),0) FROM properties) AS views,
                  (SELECT COUNT(*) FROM users WHERE status='suspended') AS suspended""")[0]

    # fill missing days with zeros so the chart has a continuous axis
    by_day = {str(r["day"]): r for r in daily}
    series = []
    for i in range(days):
        d = str((since + timedelta(days=i)).date())
        r = by_day.get(d, {})
        series.append({"day": d, **{k: int(r.get(k) or 0) for k in ("logins", "registrations", "listings", "offers")}})

    return jsonify(totals=totals, users_by_role=users_by_role, listings=listings, by_type=by_type, offers=offers,
                   by_location=by_location, activity=series, top_viewed=top_viewed, recent=recent)


@app.errorhandler(Exception)
def on_error(err):
    code = getattr(err, "code", 500)
    if isinstance(code, int) and code < 500:
        return jsonify(message=getattr(err, "description", "Bad request")), code
    app.logger.exception(err)
    return jsonify(message="Search service error. Please try again."), 500


if __name__ == "__main__":
    app.run(port=int(os.getenv("PORT", 5001)), debug=os.getenv("FLASK_DEBUG") == "1")
