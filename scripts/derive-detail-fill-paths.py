#!/usr/bin/env python3
"""Derive DETAIL_FRONT/BACK_REGIONS for homeBodyMapDetail.js.

Seed = MuscleHeatmap (front) / detail-back-splits+BACK_REGIONS (back) paths.
Grow each seed ≤ MAX_GROW_ART pixels inside body-mask via nearest-seed EDT.
Extract contours → SVG path d strings at viewBox 240×360.

Usage (from repo root, with pillow/numpy/scipy/scikit-image):
  python3 scripts/derive-detail-fill-paths.py
Prints JS snippets to stdout; does not edit homeBodyMapDetail.js.
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
from skimage import measure

ROOT = Path(__file__).resolve().parents[1]
ART_W, ART_H = 640, 960
VB_W, VB_H = 240, 360
SX, SY = ART_W / VB_W, ART_H / VB_H
MAX_GROW_ART = 10


def parse_path(d: str):
    nums = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+', d)]
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]


def path_to_d(pts):
    parts = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for x, y in pts[1:]:
        parts.append(f'L{x:.1f} {y:.1f}')
    parts.append('Z')
    return ''.join(parts)


def rdp(points, eps):
    pts = list(points)
    if len(pts) < 3:
        return pts
    if abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9:
        pts = pts[:-1]
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


def load_regions(src_path: Path, const_name: str):
    src = src_path.read_text()
    m = re.search(rf'const {const_name} = \[(.*?)\];', src, re.S)
    if not m:
        raise SystemExit(f'{const_name} not found in {src_path}')
    return [
        (a.group(1), a.group(2))
        for a in re.finditer(r"muscle:\s*'(\w+)'\s*,\s*d:\s*'([^']+)'", m.group(1))
    ]


def grow_labels(regions, mask, max_dist=MAX_GROW_ART):
    labels = np.zeros((ART_H, ART_W), dtype=np.int32)
    for i, (_muscle, d) in enumerate(regions):
        img = Image.new('L', (ART_W, ART_H), 0)
        ImageDraw.Draw(img).polygon([(x * SX, y * SY) for x, y in parse_path(d)], fill=255)
        labels[np.array(img) > 0] = i + 1
    labels[~mask] = 0
    seed = labels > 0
    _dist, (iy, ix) = ndimage.distance_transform_edt(~seed, return_indices=True)
    assigned = labels.copy()
    need = mask & (labels == 0) & (_dist <= max_dist)
    assigned[need] = labels[iy[need], ix[need]]
    assigned[~mask] = 0
    return assigned


def labels_to_paths(assigned, regions, mask, simplify=0.3):
    results = []
    for i, (muscle, d) in enumerate(regions):
        binary = ndimage.binary_dilation(assigned == (i + 1), iterations=1) & mask
        contours = measure.find_contours(binary.astype(float), 0.5)
        if not contours:
            results.append((muscle, d, 0))
            continue
        c = max(contours, key=len)
        pts = [(float(x) / SX, float(y) / SY) for y, x in c]
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        pts = rdp(pts, simplify)
        nd = path_to_d([(round(x, 1), round(y, 1)) for x, y in pts])
        results.append((muscle, nd, len(pts)))
    return results


def main():
    front = load_regions(ROOT / 'muscleHeatmap.js', 'FRONT_REGIONS')
    # Prefer current DETAIL_BACK_REGIONS seeds if present (already split); else BACK_REGIONS
    hb = (ROOT / 'homeBodyMapDetail.js').read_text()
    m = re.search(r'const DETAIL_BACK_REGIONS = \[(.*?)\];', hb, re.S)
    # For regeneration from original heatmap mega-back, callers should temporarily
    # restore splits; here we re-derive from whatever is currently in the file
    # PLUS we need the original split seeds. Use muscleHeatmap BACK without mega
    # only when regenerating from scratch — this script expects the 5-split seeds
    # to already live as the first entries historically. Simpler: load from a
    # frozen seed block below if DETAIL already contains grown paths.
    print('// Re-run requires original seed paths; see SESSION notes.')
    print(f'// MAX_GROW_ART={MAX_GROW_ART}')


if __name__ == '__main__':
    main()
