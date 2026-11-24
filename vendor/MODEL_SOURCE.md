# Body Map 3D — model & library sources

## three.js

- **Files:** `vendor/three.module.min.js`, `vendor/GLTFLoader.js`
- **Version:** r170 (`three@0.170.0`)
- **License:** MIT (`vendor/three.LICENSE.txt`)
- **Source:** https://cdn.jsdelivr.net/npm/three@0.170.0/

## Anatomical muscle figure

- **File:** `vendor/anatomy/muscles-body.glb` (~2.43 MiB, 221 named meshes, no Draco/meshopt)
- **License of shipped asset:** **CC BY-SA 4.0**
- **Direct source used:** [slfresh/fitmitwith-anatomy-atlas](https://github.com/slfresh/fitmitwith-anatomy-atlas) `models/full-body-male-mobile.glb`
  (mobile-budget adaptation with stable muscle IDs in glTF extras)
- **Upstream lineage:**
  1. **BodyParts3D** — Database Center for Life Science (Univ. of Tokyo / NBDC)  
     License historically CC BY-SA 2.1 JP; DBCLS credit line also cites CC BY 4.0  
     https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
  2. **Z-Anatomy** — Gauthier Kervyn et al., CC BY-SA 4.0  
     https://github.com/Z-Anatomy/Models-of-human-anatomy
  3. Fit Mit With atlas adaptation (decimated ~129k tris, glTF Y-up, muscle extras) — CC BY-SA 4.0

Full credit wording: `vendor/anatomy/ATTRIBUTION.txt`.

### Required attribution (short)

> Anatomy model adapted from Z-Anatomy (CC BY-SA 4.0), based on BodyParts3D
> © The Database Center for Life Science. Redistributed under CC BY-SA 4.0.

### RECOVR changes

- Mapped atlas muscle keys → app muscle ids via `vendor/anatomy/KEY_TO_APP.json`
  (coarse ids: chest/back/shoulder/… plus finer: traps, lats, front/rear delts, glutes, lower_back, abs, obliques)
- Runtime materials: matte dark grey + emissive coral/amber/mint highlighting (no source textures)
- No further mesh decimation beyond the upstream mobile GLB (already &lt; 3 MB)

### Alternatives evaluated

| Candidate | License | Why not primary |
|-----------|---------|-----------------|
| kalibismail/hoik-muscle-model `muscles.glb` (~1.9 MB) | CC BY-SA 4.0 | Also good; fewer named regions (44). Kept as known alternative. |
| Charleeh/ecorche meshopt (~5.7 MB) | CC BY-SA 4.0 | Over 3 MB budget; needs MeshoptDecoder |
| BodyParts3D raw OBJ zip (136 MB) | CC BY-SA 2.1 JP | Too heavy; would need custom build pipeline |
| Grab3D / Innerscene CC0 full-body muscle | CC0 | Single/sculpted mesh — not separately addressable muscle groups |
| Procedural capsules (previous PR iteration) | original | Rejected visually (balloon doll vs mockups) |
