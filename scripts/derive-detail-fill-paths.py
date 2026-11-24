#!/usr/bin/env python3
"""Derive DETAIL_FRONT/BACK_REGIONS for homeBodyMapDetail.js.

Approach (PR #89 fix — do NOT use nearest-seed growth inside the whole body mask):
  - Seed = MuscleHeatmap FRONT_REGIONS / main DETAIL_BACK splits + BACK_REGIONS
  - Preserve seed topology (teardrop quads, smooth pec/delt curves)
  - Mitre buffer (~0.55–0.85) to hug grey art outlines without raster ink-snap
  - Clip extremities: ankle Y=298, wrists, neck (feet/hands/head stay unfilled)
  - Light RDP; no Chaikin on pointed muscles (keeps teardrop tips)

Nearest-seed EDT growth painted feet as calves and produced sawtooth contours —
abandoned after visual cross-check against main #87.

Usage (from repo root, with pillow/numpy/shapely):
  python3 scripts/derive-detail-fill-paths.py
Prints JS snippets to stdout; does not edit homeBodyMapDetail.js.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
VB_W, VB_H = 240, 360
ANKLE_Y = 298.0
WRIST_Y = 192.0
NECK_Y = 48.0
BUF = {
    'quads': 0.55, 'adductors': 0.55, 'calves': 0.7,
    'chest': 0.85, 'shoulder': 0.8, 'default': 0.75,
}


def parse_path(d: str):
    nums = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+', d)]
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]


def path_to_d(pts):
    parts = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for x, y in pts[1:]:
        parts.append(f'L{x:.1f} {y:.1f}')
    parts.append('Z')
    return ''.join(parts)


def densify(pts, max_seg=1.2):
    n = len(pts)
    out = []
    for i in range(n):
        a = pts[i]
        b = pts[(i + 1) % n]
        out.append(a)
        dx, dy = b[0] - a[0], b[1] - a[1]
        dist = (dx * dx + dy * dy) ** 0.5
        if dist > max_seg:
            steps = int(__import__('math').ceil(dist / max_seg))
            for s in range(1, steps):
                t = s / steps
                out.append((a[0] + dx * t, a[1] + dy * t))
    return out


def rdp(points, eps):
    pts = list(points)
    if len(pts) < 3:
        return pts
    stack = [(0, len(pts) - 1)]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    while stack:
        start, end = stack.pop()
        ax, ay = pts[start]
        bx, by = pts[end]
        den = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        if den < 1e-9:
            continue
        dmax, idx = -1.0, start
        for i in range(start + 1, end):
            px, py = pts[i]
            d = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / den
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps:
            keep[idx] = True
            stack.append((start, idx))
            stack.append((idx, end))
    return [p for p, k in zip(pts, keep) if k]


def poly_from(pts):
    if len(pts) < 3:
        return Polygon()
    ring = pts + [pts[0]] if pts[0] != pts[-1] else pts
    if len(ring) < 4:
        return Polygon()
    try:
        poly = make_valid(Polygon(ring))
    except Exception:
        return Polygon()
    if poly.geom_type == 'MultiPolygon':
        poly = max(list(poly.geoms), key=lambda g: g.area)
    elif poly.geom_type != 'Polygon':
        polys = [g for g in getattr(poly, 'geoms', []) if g.geom_type == 'Polygon']
        poly = max(polys, key=lambda g: g.area) if polys else Polygon()
    return poly


def to_pts(g):
    if g is None or g.is_empty:
        return []
    if g.geom_type == 'MultiPolygon':
        g = max(g.geoms, key=lambda x: x.area)
    if g.geom_type == 'GeometryCollection':
        polys = [x for x in g.geoms if x.geom_type == 'Polygon']
        if not polys:
            return []
        g = max(polys, key=lambda x: x.area)
    if g.geom_type != 'Polygon':
        return []
    c = list(g.exterior.coords)
    return c[:-1] if c and c[0] == c[-1] else c


EXCL = unary_union([
    box(0, 0, 240, NECK_Y),
    box(0, ANKLE_Y, 240, 360),
    box(0, WRIST_Y, 48, ANKLE_Y),
    box(192, WRIST_Y, 240, ANKLE_Y),
])


def polish(pts, muscle):
    if muscle == 'calves':
        pts = [(x, y) for x, y in pts if y < ANKLE_Y - 0.2]
    if muscle == 'forearms':
        pts = [(x, y) for x, y in pts if y <= WRIST_Y]
    if len(pts) < 3:
        return pts
    dens = densify(pts, 1.5 if muscle in ('quads', 'adductors') else 1.1)
    poly = poly_from(dens if muscle in ('quads', 'adductors') else rdp(dens, 0.12))
    if poly.is_empty:
        return pts
    buf = BUF.get(muscle, BUF['default'])
    grown = poly.buffer(buf, join_style=2, mitre_limit=2.5, resolution=8)
    clipped = make_valid(grown.difference(EXCL))
    if muscle == 'calves':
        clipped = clipped.intersection(box(0, 0, 240, ANKLE_Y))
    if muscle == 'forearms':
        clipped = clipped.intersection(box(0, 0, 240, WRIST_Y + 0.5))
    final = to_pts(clipped)
    if len(final) < 5:
        final = to_pts(make_valid(poly.difference(EXCL))) or pts
    eps = 0.08 if muscle in ('quads', 'adductors', 'calves') else 0.14
    if len(final) > 12:
        final = rdp(final, eps)
    return final


def load_regions(path: Path, name: str):
    src = path.read_text()
    m = re.search(rf'const {name} = \[(.*?)\];', src, re.S)
    return [(a.group(1), a.group(2)) for a in re.finditer(
        r"muscle:\s*'(\w+)'\s*,\s*d:\s*'([^']+)'", m.group(1))]


def load_main_detail_back():
    src = subprocess.check_output(
        ['git', 'show', 'origin/main:homeBodyMapDetail.js'], text=True)
    m = re.search(r'const DETAIL_BACK_REGIONS = \[(.*?)\];', src, re.S)
    out = []
    for mm in re.finditer(
        r"\{\s*muscle:\s*'(\w+)'(?:\s*,\s*labelId:\s*'(\w+)')?\s*,\s*d:\s*'([^']+)'",
        m.group(1),
    ):
        out.append((mm.group(1), mm.group(3), mm.group(2)))
    return out


def main():
    front = load_regions(ROOT / 'muscleHeatmap.js', 'FRONT_REGIONS')
    print('  const DETAIL_FRONT_REGIONS = [')
    for muscle, d in front:
        pts = polish(parse_path(d), muscle)
        nd = path_to_d([(round(x, 1), round(y, 1)) for x, y in pts])
        print(f"    {{ muscle: '{muscle}', d: '{nd}' }},")
    print('  ];\n')

    detail = load_main_detail_back()
    back_others = [
        (m, d) for m, d in load_regions(ROOT / 'muscleHeatmap.js', 'BACK_REGIONS')
        if m != 'back'
    ]
    print('  const DETAIL_BACK_REGIONS = [')
    for muscle, d, lab in detail:
        pts = polish(parse_path(d), muscle)
        nd = path_to_d([(round(x, 1), round(y, 1)) for x, y in pts])
        if lab:
            print(f"    {{ muscle: '{muscle}', labelId: '{lab}', d: '{nd}' }},")
        else:
            print(f"    {{ muscle: '{muscle}', d: '{nd}' }},")
    for muscle, d in back_others:
        pts = polish(parse_path(d), muscle)
        nd = path_to_d([(round(x, 1), round(y, 1)) for x, y in pts])
        print(f"    {{ muscle: '{muscle}', d: '{nd}' }},")
    print('  ];')


if __name__ == '__main__':
    main()
