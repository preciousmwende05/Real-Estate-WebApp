"""
Smart search: turns a plain-English query into structured filters.

    "3 bedroom apartment in Kilimani under 80k with pool"
      -> {bedrooms: 3, property_types: ['apartment'], location_ids: [1], max_price: 80000, amenity_ids: [1]}

Anything the parser doesn't recognise is kept as a keyword and matched against title/description.
"""
import re

TYPE_WORDS = {
    "apartment": "apartment", "apartments": "apartment", "flat": "apartment", "flats": "apartment",
    "bungalow": "bungalow", "bungalows": "bungalow",
    "mansion": "mansion", "mansions": "mansion", "villa": "mansion",
}
# short words users type -> amenity names in the DB
AMENITY_ALIASES = {
    "pool": "Swimming Pool", "swimming": "Swimming Pool", "gym": "Gym", "parking": "Parking",
    "garden": "Garden", "security": "24hr Security", "borehole": "Borehole", "generator": "Backup Generator",
    "wifi": "Wi-Fi", "wi-fi": "Wi-Fi", "internet": "Wi-Fi", "balcony": "Balcony", "lift": "Lift",
    "elevator": "Lift", "cctv": "CCTV", "sq": "Servant Quarters", "dsq": "Servant Quarters",
    "playground": "Playground", "solar": "Solar Water Heating",
}
STOP_WORDS = {"in", "at", "a", "an", "the", "with", "and", "near", "for", "to", "of", "house", "houses",
              "home", "homes", "rent", "sale", "buy", "bed", "beds", "bedroom", "bedrooms", "br", "under",
              "below", "less", "than", "over", "above", "more", "max", "min", "budget", "around", "kes", "ksh",
              "between", "cheap", "affordable", "luxury"}


def _money(num, suffix):
    value = float(num.replace(",", ""))
    suffix = (suffix or "").lower()
    if suffix in ("k", "thousand"):
        value *= 1_000
    elif suffix in ("m", "mn", "million"):
        value *= 1_000_000
    return value


MONEY = r"(?:kes|ksh)?\s*([\d,]+(?:\.\d+)?)\s*(k|m|mn|million|thousand)?\b"


def parse(text, locations, amenities):
    """locations: [{id,name}], amenities: [{id,name}] -> (filters dict, leftover keyword)"""
    q = " " + text.lower().strip() + " "
    f = {"location_ids": [], "property_types": [], "amenity_ids": []}

    m = re.search(r"between\s+" + MONEY + r"\s+(?:and|-|to)\s+" + MONEY, q)
    if m:
        f["min_price"], f["max_price"] = _money(m.group(1), m.group(2)), _money(m.group(3), m.group(4))
        q = q.replace(m.group(0), " ")
    m = re.search(r"(?:under|below|less than|max(?:imum)?|budget(?: of)?|up to)\s+" + MONEY, q)
    if m:
        f["max_price"] = _money(m.group(1), m.group(2))
        q = q.replace(m.group(0), " ")
    m = re.search(r"(?:over|above|more than|min(?:imum)?|from)\s+" + MONEY, q)
    if m:
        f["min_price"] = _money(m.group(1), m.group(2))
        q = q.replace(m.group(0), " ")

    m = re.search(r"\b([1-5])\s*[- ]?(?:bed(?:room)?s?|br)\b", q)
    if m:
        f["bedrooms"] = int(m.group(1))
        q = q.replace(m.group(0), " ")

    # longest location names first so "Kiambu Town" wins over "Kiambu"
    for loc in sorted(locations, key=lambda l: -len(l["name"])):
        pattern = r"\b" + re.escape(loc["name"].lower()) + r"\b"
        if re.search(pattern, q):
            f["location_ids"].append(loc["id"])
            q = re.sub(pattern, " ", q)

    amenity_by_name = {a["name"]: a["id"] for a in amenities}
    for word in re.findall(r"[a-z\-]+", q):
        if word in TYPE_WORDS and TYPE_WORDS[word] not in f["property_types"]:
            f["property_types"].append(TYPE_WORDS[word])
        elif word in AMENITY_ALIASES and amenity_by_name.get(AMENITY_ALIASES[word]) not in f["amenity_ids"]:
            f["amenity_ids"].append(amenity_by_name[AMENITY_ALIASES[word]])
        else:
            continue
        q = re.sub(r"\b" + re.escape(word) + r"\b", " ", q)

    leftover = " ".join(w for w in re.findall(r"[a-z0-9\-]+", q) if w not in STOP_WORDS and len(w) > 2)
    return {k: v for k, v in f.items() if v not in ([], None)}, leftover
