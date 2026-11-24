# Body Map 3D — model & library sources

## three.js

- **File:** `vendor/three.module.min.js`
- **Version:** r170 (`three@0.170.0`)
- **License:** MIT (see `vendor/three.LICENSE.txt`)
- **Source:** https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js

## Human muscle figure

No third-party glTF is shipped. The interactive figure is a **procedural, stylized low-poly muscle body** built at runtime from Three.js primitives (spheres, capsules, boxes, ellipsoids) in `bodyMap3d.js`.

Each mesh is tagged with one of the app's existing muscle ids:

`chest`, `back`, `shoulder`, `biceps`, `triceps`, `quads`, `hamstrings`, `adductors`, `calves`, `core`, `forearms`

**License of the procedural figure:** original to this project (CC0 / public domain dedication for the geometry layout itself). No external anatomy asset is required offline.
