# Body map 3D modes — Recovery / Growth / Loss

Home heatmap uses **one shared WebGL stage** (`Heatmap3dModes` → `BodyMap3D` mount id `home-modes`). Switching modes crossfades materials (~400ms) and keeps yaw/rotation.

## Screens touched
- `#heatmapModeHost` tabs: Recovery · Growth · Loss
- Shared host `#h3dSharedHost` (single renderer/scene)
- 2D fallback still uses `MuscleHeatmap` (recovery) and `MuscleGrowthDetail` (growth/loss combined SVG)
- Live logging / workout-complete keep their own mounts (`live`, `complete`)

## Color legends (English UI)
| Mode | Palette |
|------|---------|
| Recovery | Coral fatigued · Amber recovering · Mint ready |
| Growth | Deep mint → bright mint by growth amount |
| Loss | Violet → deep indigo by loss amount |

## Formulas (from `MuscleGrowthTracker`, estimates — not DXA)

### Growth (per muscle)
- Window: last **28 days**, split into recent **14d** vs prior **14d**
- Sessions that hit the muscle (via exercise-name → muscle keywords) contribute volume
- `overloadFactor = clamp(recentAvgVol / priorAvgVol, 0.7..1.3)` (neutral 1.0 if prior empty)
- `freqFactor = clamp(sessionCount / 8, 0..1)` (ideal ≈ 2×/week × 4 weeks)
- `growthPct = round(freqFactor × overloadScore × 3.0, 1)` where overloadScore normalizes overloadFactor into 0..1  
- Display cap: **MAX_GROWTH_PCT = 3**

### Loss / detraining (per muscle)
- `daysSince` = days since last session that hit the muscle
- If `daysSince ≤ 14` → `lossPct = 0` (no measurable loss)
- Else linear ramp to day **56**: `lossPct = ((daysSince−14)/(56−14)) × 8`, capped  
- Display cap: **MAX_LOSS_PCT = 8**

### Recovery
Unchanged: `calcMuscleRecovery` in `app.js` (hours elapsed / recoveryHours → %).

## Limitations
- Indices are training-pattern estimates, not measured muscle mass
- Growth/loss use coarse app muscle ids; fine GLB meshes inherit via alias map
- 2D growth panel remains a combined growth·loss SVG (3D splits the modes)
- Prefer single home WebGL context; dispose when switching to 2D or leaving home
