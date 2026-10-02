"""
Generates illustrated cover images for the seeded properties.
Output: server/uploads/seed/<type>-<n>.svg  (6 variants per property type)
Run:    python database/generate_images.py
Real listings use photos uploaded by sellers; these are only for demo data.
"""
import os
import random

OUT = os.path.join(os.path.dirname(__file__), "..", "server", "uploads", "seed")
W, H = 800, 520

SKIES = [  # (top, bottom, celestial, kind)
    ("#5fa8e8", "#d6ecfb", "#ffe27a", "sun"),
    ("#f39c6b", "#fde3b0", "#fff1c1", "sun"),
    ("#0b1f3a", "#3b4f7a", "#f4f1de", "moon"),
    ("#7ec4e6", "#eaf6fb", "#fff3a0", "sun"),
    ("#c86b85", "#f7c9a8", "#ffe9c7", "sun"),
    ("#13294b", "#c9a227", "#fbe7a1", "sun"),
]
WALLS = ["#f4efe6", "#e9dcc7", "#dfe6ee", "#f7f3ea", "#e6d3b3", "#ffffff"]
ROOFS = ["#8b3a2b", "#5a3d2b", "#33415c", "#7a5c3e", "#a0522d", "#2f3e46"]
ACCENT = "#c9a227"  # gold
NAVY = "#0b1f3a"


def window(x, y, w, h, lit):
    fill = "#ffd36b" if lit else "#9cc3e0"
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="{fill}" stroke="#ffffff" stroke-width="2"/>'
            f'<line x1="{x + w / 2}" y1="{y}" x2="{x + w / 2}" y2="{y + h}" stroke="#ffffff" stroke-width="1.5"/>')


def tree(x, base, s, dark):
    leaf = "#1f4d2b" if dark else "#3f8f4a"
    leaf2 = "#173b21" if dark else "#2f7339"
    return (f'<rect x="{x - 4 * s}" y="{base - 40 * s}" width="{8 * s}" height="{40 * s}" fill="#5b3a1e"/>'
            f'<circle cx="{x}" cy="{base - 55 * s}" r="{26 * s}" fill="{leaf}"/>'
            f'<circle cx="{x - 16 * s}" cy="{base - 42 * s}" r="{18 * s}" fill="{leaf2}"/>'
            f'<circle cx="{x + 16 * s}" cy="{base - 44 * s}" r="{18 * s}" fill="{leaf2}"/>')


def palm(x, base, dark):
    c = "#1f4d2b" if dark else "#2e7d32"
    fronds = "".join(
        f'<path d="M{x} {base - 120} q {dx} {-20} {dx * 2} {dy}" stroke="{c}" stroke-width="9" fill="none" stroke-linecap="round"/>'
        for dx, dy in [(-30, 10), (30, 10), (-22, 30), (22, 30), (0, -10)])
    return f'<path d="M{x} {base} q 8 -60 0 -120" stroke="#7a5230" stroke-width="9" fill="none"/>' + fronds


def background(sky, rnd):
    top, bottom, cel, kind = sky
    dark = kind == "moon" or top == "#13294b"
    s = [f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
         f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    if kind == "moon":
        for _ in range(40):
            s.append(f'<circle cx="{rnd.randint(0, W)}" cy="{rnd.randint(0, 220)}" r="{rnd.choice([1, 1, 1.5])}" fill="#fff" opacity="0.8"/>')
    cx, cy = rnd.randint(560, 720), rnd.randint(60, 120)
    s.append(f'<circle cx="{cx}" cy="{cy}" r="38" fill="{cel}" opacity="0.95"/>')
    hill = "#2c4a3a" if dark else "#9cc79a"
    hill2 = "#22392d" if dark else "#7fb57e"
    s.append(f'<path d="M0 360 Q 160 280 330 340 T 800 320 V {H} H0Z" fill="{hill}"/>')
    s.append(f'<path d="M0 390 Q 250 340 480 380 T 800 370 V {H} H0Z" fill="{hill2}"/>')
    s.append(f'<rect y="430" width="{W}" height="{H - 430}" fill="{"#2f5d3a" if dark else "#6fae5f"}"/>')
    return "".join(s), dark


def apartment(rnd, wall, roof, dark):
    floors = rnd.randint(5, 7)
    fh = 40
    bw = 300
    bx = 250
    top = 432 - floors * fh
    s = [f'<rect x="{bx - 140}" y="{top + 60}" width="140" height="{432 - top - 60}" fill="{wall}" opacity="0.75"/>',
         f'<rect x="{bx}" y="{top}" width="{bw}" height="{432 - top}" fill="{wall}" stroke="{NAVY}" stroke-width="2"/>',
         f'<rect x="{bx - 8}" y="{top - 12}" width="{bw + 16}" height="14" fill="{roof}"/>']
    for f in range(floors):
        y = top + 10 + f * fh
        for i in range(5):
            s.append(window(bx + 18 + i * 56, y, 38, 24, dark and rnd.random() > 0.35))
        if f < floors - 1:
            s.append(f'<rect x="{bx + 10}" y="{y + 28}" width="{bw - 20}" height="5" fill="{ACCENT}"/>')
    for f in range(floors - 1):
        y = top + 70 + f * fh
        for i in range(3):
            s.append(window(bx - 125 + i * 44, y, 30, 20, dark and rnd.random() > 0.5))
    s.append(f'<rect x="{bx + bw / 2 - 25}" y="392" width="50" height="40" fill="{NAVY}"/>')
    s.append(f'<rect x="{bx + bw / 2 - 40}" y="384" width="80" height="8" fill="{ACCENT}"/>')
    return "".join(s)


def bungalow(rnd, wall, roof, dark):
    bx, by, bw, bh = 200, 320, 400, 112
    s = [f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="{wall}" stroke="{NAVY}" stroke-width="2"/>',
         f'<polygon points="{bx - 30},{by} {bx + bw / 2},{by - 95} {bx + bw + 30},{by}" fill="{roof}"/>',
         f'<rect x="{bx + 300}" y="{by - 85}" width="24" height="45" fill="{roof}" stroke="{NAVY}"/>',
         f'<rect x="{bx + bw / 2 - 28}" y="{by + 40}" width="56" height="72" fill="{NAVY}"/>',
         f'<circle cx="{bx + bw / 2 + 18}" cy="{by + 78}" r="3" fill="{ACCENT}"/>',
         f'<rect x="{bx + bw / 2 - 70}" y="{by + 4}" width="140" height="10" fill="{ACCENT}"/>']
    for wx in (bx + 40, bx + 110, bx + 250, bx + 320):
        s.append(window(wx, by + 38, 44, 40, dark and rnd.random() > 0.3))
    s.append(f'<path d="M{bx + bw / 2 - 28} 432 L {bx + bw / 2 - 60} {H} H {bx + bw / 2 + 60} L {bx + bw / 2 + 28} 432Z" fill="#d9c9a3"/>')
    return "".join(s)


def mansion(rnd, wall, roof, dark):
    bx, by, bw = 140, 250, 520
    s = [f'<rect x="{bx}" y="{by}" width="{bw}" height="{432 - by}" fill="{wall}" stroke="{NAVY}" stroke-width="2"/>',
         f'<polygon points="{bx - 20},{by} {bx + 60},{by - 60} {bx + bw - 60},{by - 60} {bx + bw + 20},{by}" fill="{roof}"/>',
         f'<polygon points="{bx + bw / 2 - 90},{by + 10} {bx + bw / 2},{by - 50} {bx + bw / 2 + 90},{by + 10}" fill="{wall}" stroke="{NAVY}" stroke-width="2"/>',
         f'<rect x="{bx}" y="{by + 88}" width="{bw}" height="6" fill="{ACCENT}"/>']
    for row in (by + 22, by + 110):
        for i in range(8):
            wx = bx + 22 + i * 63
            if 3 <= i <= 4:
                continue
            s.append(window(wx, row, 36, 50, dark and rnd.random() > 0.3))
    for i in range(4):
        cx = bx + bw / 2 - 72 + i * 48
        s.append(f'<rect x="{cx}" y="{by + 10}" width="12" height="{432 - by - 10}" fill="#ffffff" stroke="{NAVY}" stroke-width="1"/>')
    s.append(f'<rect x="{bx + bw / 2 - 26}" y="362" width="52" height="70" fill="{NAVY}"/>')
    s.append(f'<rect x="{bx + bw / 2 - 40}" y="432" width="80" height="10" fill="#e8e1d0"/>')
    if rnd.random() > 0.3:  # pool
        s.append(f'<rect x="80" y="455" width="230" height="45" rx="8" fill="#4fc3f7" stroke="#ffffff" stroke-width="5"/>'
                 f'<path d="M100 475 q 15 -8 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0" stroke="#e1f5fe" stroke-width="3" fill="none"/>')
    return "".join(s)


BUILDERS = {"apartment": apartment, "bungalow": bungalow, "mansion": mansion}


def make(ptype, n):
    rnd = random.Random(f"{ptype}-{n}")
    sky = SKIES[n % len(SKIES)]
    bg, dark = background(sky, rnd)
    wall, roof = WALLS[(n + 2) % len(WALLS)], ROOFS[(n * 5) % len(ROOFS)]
    body = BUILDERS[ptype](rnd, wall, roof, dark)
    trees = tree(90, 432, 1.1, dark) + tree(720, 432, 1.3, dark)
    if ptype == "mansion":
        trees = palm(60, 440, dark) + palm(745, 440, dark)
    fence = "".join(f'<rect x="{x}" y="470" width="6" height="40" fill="#ffffff" opacity="0.85"/>' for x in range(0, W, 26)) \
        if ptype == "bungalow" else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
            f'{bg}{trees}{body}{fence}</svg>')


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for ptype in BUILDERS:
        for n in range(1, 7):
            with open(os.path.join(OUT, f"{ptype}-{n}.svg"), "w") as fh:
                fh.write(make(ptype, n))
    print("Images written to", os.path.abspath(OUT))
