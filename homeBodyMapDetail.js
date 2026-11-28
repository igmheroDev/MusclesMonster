// ============================================================
// RECOVR - 홈 3D 바디맵 "자세히 보기" (독립 모듈)
//
// 3D는 재미용 · 2D는 정확한 상세 보기.
// Heatmap3dModes의 현재 모드(회복/성장/손실)를 따르며,
// 기존 MuscleHeatmap SVG · calcMuscleRecovery · MuscleGrowthTracker
// 계산만 읽기 전용으로 재사용한다.
// BodyMap3D.setPreferredMode / 전역 2D·3D 선호는 건드리지 않는다.
// ============================================================

const HomeBodyMapDetail = (() => {
  const STYLE_ID = 'home-body-map-detail-styles';
  const BTN_WRAP_ID = 'hbmdDetailBtnWrap';
  const OVERLAY_ID = 'hbmdOverlay';
  const HISTORY_FLAG = 'hbmdDetail';
  const ASSET_VERSION = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.ASSET_VERSION) || 'v56';
  const MIN_TAP = 44;
  // Must match map paint thresholds (getFill) for card + list value colors
  const STRONG_GROWTH_PCT = 1.5;
  const GROWTH_TEAL = '#1aa88a';
  const GROWTH_LIME = '#b8ff3d';
  const STRONG_LOSS_PCT = 4;
  const REGION_STROKE = 'rgba(8,8,14,0.85)';
  const REGION_STROKE_W = 1.15;
  const LABEL_LINE_H = 28; // name + pct stack at ~390px CSS width
  const LABEL_MIN_GAP = 8;
  const LOSS_VIOLET = '#7b6cff';
  const LOSS_INDIGO = '#4a3dc8';
  // Fill paths: smooth seed vectors + 0.9px buffer; extremities clipped; no calibrate.

  const MODE_TITLES = {
    recovery: '회복 자세히 보기',
    growth: '성장 자세히 보기',
    loss: '손실 자세히 보기',
  };
  const MODE_KICKERS = {
    recovery: '회복',
    growth: '성장',
    loss: '손실',
  };

  // Front / back muscles visible on that silhouette (app coarse keys).
  const VIEW_MUSCLES = {
    front: ['chest', 'shoulder', 'biceps', 'core', 'forearms', 'quads', 'adductors', 'calves'],
    back: ['back', 'shoulder', 'triceps', 'forearms', 'hamstrings', 'adductors', 'calves'],
  };

  // Detail-only label ids that share an app muscle bucket (3D KEY_TO_APP / LOAD_ALIASES).
  const LABEL_DATA_KEY = {
    glutes: 'hamstrings',
  };

  const DETAIL_SHORT_NAMES = {
    glutes: '둔근',
  };

  /**
   * Smooth vector fills from MuscleHeatmap seeds (teardrop tips preserved).
   * Mitre buffer hugs art outlines; feet/hands/head clipped (ankle Y=298).
   * No nearest-seed / raster ink-snap (avoids feet leak + sawtooth edges).
   */
  const DETAIL_FRONT_REGIONS = [
    { muscle: 'shoulder', d: 'M92.6 72.0L86.6 72.8L84.8 73.5L83.2 74.2L82.1 75.0L81.0 75.8L79.9 76.5L79.1 77.2L78.8 78.0L78.0 78.8L77.2 80.2L76.5 81.0L76.1 81.8L75.8 82.5L75.8 83.2L75.4 84.0L75.0 84.8L74.6 85.5L74.6 86.2L74.6 87.0L74.2 88.5L74.2 89.2L73.9 90.0L73.9 90.8L73.9 91.5L73.9 92.2L73.9 93.0L73.9 93.8L73.9 94.5L74.6 96.0L75.0 96.0L77.2 94.5L78.4 93.8L79.9 93.0L81.0 92.2L82.1 91.5L83.2 90.8L84.0 90.0L84.8 89.2L85.5 88.5L86.6 87.0L87.4 86.2L87.8 85.5L88.1 84.8L88.5 84.0L88.9 83.2L89.6 82.5L90.0 81.8L90.4 81.0L90.8 80.2L91.9 78.8L92.6 78.0L93.0 77.2L93.8 76.5L94.1 75.8L94.9 75.0L95.2 74.2L95.6 73.5L95.2 72.8L92.6 72.0Z' },
    { muscle: 'shoulder', d: 'M142.4 72.6L142.4 74.3L143.4 75.1L146.4 79.7L147.3 80.3L147.3 80.8L147.8 81.8L150.8 86.3L151.5 87.9L154.7 91.0L156.6 92.6L163.3 96.4L165.4 96.4L165.4 94.3L165.8 93.6L165.8 90.2L165.4 89.4L165.4 87.9L165.0 87.1L164.7 84.8L164.2 84.1L163.5 81.8L162.2 79.4L161.3 78.7L161.3 78.1L158.0 74.8L156.8 73.9L153.7 72.3L150.9 71.6L144.2 71.6Z' },
    { muscle: 'chest', d: 'M94.9 76.4L94.2 77.9L93.4 78.6L92.7 80.1L91.8 81.0L91.5 82.4L90.4 83.0L87.5 88.9L87.9 89.6L87.2 90.9L87.2 92.0L88.4 97.4L90.1 100.6L91.1 102.0L91.5 102.9L93.3 104.6L96.7 106.9L101.9 108.4L136.2 108.4L142.2 106.9L145.4 104.5L147.7 102.1L148.5 100.6L149.2 99.9L150.1 97.9L149.9 97.2L150.8 96.0L151.7 92.0L151.2 88.7L149.2 84.7L148.1 83.1L146.9 80.8L145.9 80.1L145.6 78.7L144.6 77.8L142.0 74.0L140.9 73.1L97.8 73.1Z' },
    { muscle: 'biceps', d: 'M84.8 92.2L83.6 93.0L81.0 94.5L79.9 95.2L77.2 96.8L76.1 97.5L74.6 99.0L73.9 99.8L72.8 101.2L72.4 102.0L71.6 103.5L71.2 105.0L70.9 105.8L70.5 107.2L70.1 108.0L70.1 109.5L69.8 110.3L69.8 111.8L69.8 112.5L69.4 114.0L69.4 115.5L69.4 116.2L69.8 117.8L69.8 118.5L70.1 120.0L70.5 120.7L70.9 122.2L71.2 123.0L72.0 124.5L73.5 126.0L75.0 126.0L78.0 124.5L79.5 123.0L80.2 122.2L81.4 120.7L81.8 120.0L82.5 118.5L82.9 117.8L83.6 116.2L84.0 115.5L84.4 114.0L85.1 112.5L85.5 111.8L85.9 110.3L86.2 109.5L86.2 108.0L86.6 107.2L87.0 105.8L87.0 105.0L87.0 103.5L87.4 102.0L87.4 101.2L87.4 99.8L87.4 99.0L87.0 97.5L86.6 96.8L86.2 95.2L85.9 94.5L85.5 93.0L84.8 92.2Z' },
    { muscle: 'biceps', d: 'M153.8 92.2L153.4 93.0L152.6 94.5L152.6 95.2L152.2 96.8L151.9 97.5L151.5 99.0L151.5 99.8L151.5 101.2L151.5 102.0L151.5 103.5L151.9 105.0L151.9 105.8L152.2 107.2L152.2 108.0L152.6 109.5L153.0 110.3L153.4 111.8L153.8 112.5L154.1 114.0L154.9 115.5L155.2 116.2L156.0 117.8L156.4 118.5L157.1 120.0L157.5 120.7L158.6 122.2L159.4 123.0L160.9 124.5L163.5 126.0L165.4 126.0L166.9 124.5L167.6 123.0L168.0 122.2L168.4 120.7L168.8 120.0L169.1 118.5L169.1 117.8L169.5 116.2L169.5 115.5L169.5 114.0L169.1 112.5L169.1 111.8L168.8 110.3L168.8 109.5L168.4 108.0L168.4 107.2L168.0 105.8L167.6 105.0L166.9 103.5L166.1 102.0L165.8 101.2L165.0 99.8L164.2 99.0L162.8 97.5L161.2 96.8L159.0 95.2L157.5 94.5L154.9 93.0L153.8 92.2Z' },
    { muscle: 'core', d: 'M149.2 102.0L89.6 104.3L90.0 107.2L90.8 110.3L91.5 113.2L92.2 115.5L93.4 118.5L94.1 121.5L95.2 124.5L95.6 126.8L96.0 129.8L96.0 132.8L97.5 135.8L94.5 138.0L94.5 141.0L93.8 144.0L93.4 147.0L94.1 149.2L97.5 152.2L100.9 155.2L104.2 158.2L106.5 160.5L105.4 163.5L106.5 166.5L107.6 169.5L108.4 171.8L109.1 174.8L110.2 177.8L112.5 180.8L117.0 183.8L121.9 183.8L126.0 180.8L128.2 177.8L129.4 174.8L130.1 171.8L130.9 169.5L132.0 166.5L133.1 163.5L132.0 160.5L134.2 158.2L137.6 155.2L141.0 152.2L144.4 149.2L145.1 147.0L144.8 144.0L144.4 141.0L143.6 138.0L140.2 135.8L142.5 132.8L142.5 129.8L142.9 126.8L143.6 124.5L144.4 121.5L145.5 118.5L146.6 115.5L147.4 113.2L148.1 110.3L148.5 107.2L149.2 104.3L149.2 102.0Z' },
    { muscle: 'forearms', d: 'M61.2 131.3L58.9 138.9L57.1 150.9L56.2 154.0L56.2 156.2L55.2 158.3L53.4 163.4L49.8 165.5L46.6 167.9L44.8 170.9L39.9 176.1L46.7 179.3L45.4 183.2L43.7 191.7L53.8 191.7L58.0 189.1L59.9 183.6L60.3 181.3L61.1 179.1L62.7 171.4L62.2 168.1L61.0 166.2L63.2 164.4L65.2 161.2L65.9 159.0L67.7 156.9L72.7 149.3L77.6 139.4L78.7 136.3L80.4 128.0L70.7 125.8L70.1 123.8L68.6 121.2L67.1 121.2L63.9 126.0Z' },
    { muscle: 'forearms', d: 'M168.2 125.8L159.1 128.0L159.1 131.7L160.2 136.3L163.2 143.9L165.1 147.0L166.2 149.3L171.1 156.8L175.3 164.4L177.9 166.3L176.7 168.1L176.2 171.4L178.2 181.3L180.1 186.6L180.4 189.1L185.0 191.7L195.1 191.7L194.2 186.2L192.8 183.2L192.8 181.0L192.1 179.3L198.9 176.1L193.7 171.0L192.2 167.9L189.0 165.5L185.5 163.4L184.1 160.7L183.7 158.4L182.9 156.2L179.2 135.9L177.7 131.3L175.1 126.0L173.5 123.6L171.3 121.2L170.1 121.2L168.8 123.8Z' },
    { muscle: 'quads', d: 'M92.5 153.0L91.7 155.0L90.6 158.9L89.1 165.7L88.7 168.7L88.0 172.4L87.3 179.1L86.5 182.9L85.7 189.7L85.4 193.5L85.4 200.2L86.5 210.1L88.0 217.6L89.5 224.3L89.9 227.3L90.9 231.0L89.8 234.8L90.3 237.9L91.7 241.7L93.3 244.7L94.4 248.3L95.3 253.3L95.5 253.4L98.0 248.5L100.6 244.8L104.7 238.0L106.0 234.7L102.4 231.0L106.0 227.4L105.5 224.1L104.7 220.4L103.7 210.0L104.7 200.3L105.5 196.6L106.3 189.9L107.0 186.1L107.4 183.1L107.7 179.3L108.2 176.2L107.0 172.3L104.4 165.6L103.3 161.8L101.3 158.7L98.3 154.8L94.0 151.6L93.0 151.6Z' },
    { muscle: 'quads', d: 'M143.5 152.5L140.6 154.8L136.7 158.7L133.7 165.7L133.4 168.6L131.5 172.3L130.7 176.1L130.3 179.2L131.1 183.1L131.5 186.1L132.3 189.9L132.6 193.6L133.4 196.6L133.7 200.3L134.8 210.0L134.1 217.4L133.4 220.4L132.5 227.4L136.1 231.0L132.5 234.7L133.7 238.0L137.9 244.8L140.5 248.5L143.0 253.4L143.2 253.3L144.1 248.3L145.3 244.7L146.7 241.7L147.5 238.0L148.7 234.8L148.0 231.0L149.7 220.6L150.5 217.6L152.0 210.1L153.2 200.2L153.2 193.5L152.4 185.9L152.0 182.9L151.3 179.1L150.5 172.4L149.7 168.7L149.4 165.7L147.9 158.9L146.7 155.0L145.0 151.3Z' },
    { muscle: 'adductors', d: 'M108.5 182.2L108.9 183.7L108.3 185.0L107.9 186.7L107.9 188.1L107.1 191.1L106.7 193.5L106.7 194.9L106.0 197.9L106.0 199.4L105.5 200.9L105.5 202.5L105.3 204.7L104.9 206.1L104.9 213.8L105.2 216.0L105.2 217.6L106.0 220.6L106.0 222.1L106.7 225.1L106.7 228.5L107.5 228.6L108.1 225.1L109.6 219.1L111.5 212.4L112.3 211.0L113.4 206.3L114.1 202.6L115.0 199.6L115.0 198.1L115.6 195.1L115.6 193.5L116.0 191.2L116.0 188.1L115.6 186.6L114.9 184.9L111.4 181.8L110.2 180.2L109.1 180.2Z' },
    { muscle: 'adductors', d: 'M127.1 181.8L123.6 184.9L122.9 186.7L122.9 193.6L123.5 196.6L123.5 198.1L124.4 201.1L124.4 202.5L124.7 205.0L125.5 206.3L125.5 207.8L125.9 209.5L126.6 211.0L129.3 220.6L130.4 225.1L130.8 228.6L131.8 228.5L131.8 225.1L132.6 222.1L132.6 220.6L133.0 219.1L133.0 217.6L133.3 216.1L133.7 213.8L133.7 204.7L133.0 202.4L133.0 200.9L132.2 197.9L132.2 196.4L131.8 194.9L131.8 193.5L131.4 191.1L130.4 186.7L130.4 185.1L130.0 183.7L130.0 182.1L129.3 179.8Z' },
    { muscle: 'calves', d: 'M84.4 252.3L83.7 258.4L83.7 263.7L85.2 272.7L86.7 278.7L87.1 281.7L87.8 284.0L89.4 296.6L98.2 296.6L98.2 292.9L99.3 284.1L100.1 281.8L100.8 278.8L105.3 266.8L106.1 261.5L106.1 255.4L104.8 245.8L91.3 242.8L90.0 240.4L88.8 240.4L85.9 246.2Z' },
    { muscle: 'calves', d: 'M133.6 245.8L132.8 249.3L132.8 252.4L132.1 258.4L132.8 264.6L133.9 267.5L133.9 269.7L135.2 272.9L136.9 275.9L138.4 281.8L139.5 284.7L139.5 287.6L140.3 293.6L140.3 297.3L148.7 297.3L149.9 287.7L150.7 284.7L151.1 281.7L153.3 272.7L154.1 267.5L154.8 261.4L154.8 258.4L154.1 252.3L152.6 246.2L149.6 240.4L148.5 240.4L147.3 242.8Z' },
  ];

  // Smooth vector fills for back (detail splits + remaining). Same derivation as front.
  const DETAIL_BACK_REGIONS = [
    { muscle: 'back', d: 'M110.7 55.9L107.5 60.2L100.5 64.6L92.3 70.4L96.9 75.5L99.9 79.9L105.1 89.5L106.2 94.0L107.8 98.8L131.8 98.8L134.9 89.5L137.2 84.3L142.0 75.5L147.4 70.4L132.1 60.2L128.9 55.9L128.1 51.0L111.5 51.0Z' },
    { muscle: 'back', d: 'M86.9 103.0L88.2 108.2L90.1 112.8L91.5 117.3L95.7 127.1L97.1 131.2L96.1 135.7L95.6 138.8L143.9 138.8L142.2 131.3L145.5 122.5L147.7 117.3L149.9 112.8L151.5 108.2L152.8 103.0L142.2 100.2L97.4 100.2Z' },
    { muscle: 'back', d: 'M94.5 145.4L94.2 149.9L93.1 155.0L91.9 159.6L90.4 164.0L90.2 165.8L149.1 165.8L148.1 159.6L145.2 149.9L145.2 145.4L144.2 140.2L95.4 140.2Z' },
    { muscle: 'hamstrings', labelId: 'glutes', d: 'M89.6 174.0L90.4 178.7L92.8 183.6L103.3 188.9L120.8 188.9L120.8 167.2L90.2 167.2Z' },
    { muscle: 'hamstrings', labelId: 'glutes', d: 'M119.2 188.9L136.0 188.9L146.0 183.6L148.8 178.8L149.7 174.1L149.5 167.2L119.2 167.2Z' },
    { muscle: 'shoulder', d: 'M84.9 70.8L81.0 72.4L77.0 75.5L75.8 77.2L73.3 82.1L73.7 82.9L72.7 84.9L72.7 87.3L72.3 88.8L72.3 94.8L85.7 96.3L87.2 98.4L90.3 101.5L92.6 103.1L96.6 104.7L106.8 104.7L109.4 102.6L106.9 97.6L105.7 93.8L104.6 90.8L103.9 89.4L103.9 88.7L99.6 80.1L97.0 78.2L97.3 77.7L96.7 75.6L95.5 74.8L94.8 73.4L92.4 70.9L90.6 70.1L89.1 70.1Z' },
    { muscle: 'shoulder', d: 'M147.4 70.9L144.5 73.4L142.9 75.8L142.3 77.7L142.5 78.1L140.4 79.3L138.8 81.7L136.5 86.3L135.8 88.6L134.6 90.9L134.6 91.7L133.8 93.2L133.8 93.9L133.1 95.4L133.1 96.2L132.0 98.3L131.6 99.8L130.2 102.6L132.8 104.7L143.1 104.7L147.0 103.1L149.4 101.5L152.6 98.4L154.3 94.9L166.9 94.2L166.9 86.5L166.6 84.2L165.3 80.3L164.2 78.0L163.5 77.1L162.6 75.6L158.3 72.4L154.3 70.8L149.0 70.1Z' },
    { muscle: 'triceps', d: 'M76.8 92.7L74.5 94.3L71.4 98.2L70.5 99.8L70.2 101.3L69.3 102.9L69.3 105.2L68.7 106.7L67.4 112.1L67.8 113.6L67.5 115.0L67.5 116.5L67.2 117.3L67.2 122.1L68.2 123.6L68.2 127.2L69.2 130.8L72.2 130.8L74.7 129.2L79.4 124.5L83.2 116.9L83.6 115.4L84.3 113.9L85.1 110.9L85.5 110.2L86.2 107.0L86.2 100.0L85.5 97.0L85.5 96.2L84.7 94.6L84.0 91.8L84.0 90.3L82.8 90.3Z' },
    { muscle: 'triceps', d: 'M156.4 91.1L156.0 91.9L156.0 93.4L155.2 94.9L154.9 96.4L154.5 97.1L154.1 98.6L154.1 100.1L153.8 101.6L153.8 103.1L153.8 103.9L153.8 105.4L154.5 106.9L154.5 108.4L155.2 109.9L154.9 110.6L155.2 112.1L156.4 113.6L156.4 115.1L157.1 116.6L157.1 117.4L157.9 118.9L158.6 120.4L159.4 121.9L160.1 123.4L160.9 124.1L162.0 125.6L163.5 127.1L165.4 128.6L167.6 130.1L169.1 130.1L170.2 128.6L170.2 127.1L170.2 125.6L170.2 124.1L170.6 123.4L171.4 121.9L171.8 120.4L171.4 118.9L171.4 117.4L171.4 116.6L171.4 115.1L171.4 113.6L171.0 112.1L170.6 110.6L170.6 109.9L170.6 108.4L170.2 106.9L169.9 105.4L169.1 103.9L169.1 103.1L168.8 101.6L168.0 100.1L167.2 98.6L166.5 97.1L165.8 96.4L163.9 94.9L162.4 93.4L158.6 91.9L156.4 91.1Z' },
    { muscle: 'forearms', d: 'M62.4 127.8L61.2 130.2L59.3 135.6L58.9 137.8L58.1 140.1L58.1 142.4L56.2 154.4L56.2 156.7L54.4 161.8L54.1 163.8L47.9 168.2L44.9 171.3L40.4 176.5L46.1 179.0L46.1 180.7L45.4 183.6L44.7 185.7L43.5 188.0L43.5 191.2L56.7 191.2L61.1 178.8L62.2 176.4L62.2 168.3L57.2 166.5L62.8 164.8L64.1 162.3L64.8 160.1L66.7 157.2L68.8 152.6L70.7 150.5L72.2 148.2L74.9 142.8L77.2 136.0L78.5 129.9L68.2 127.6L68.2 125.9L67.7 123.0L66.0 123.0L64.3 125.5Z' },
    { muscle: 'forearms', d: 'M172.5 123.8L172.1 126.0L161.6 128.2L162.0 130.5L162.4 132.8L162.8 135.8L163.5 138.0L164.2 140.2L165.4 142.5L166.5 144.8L168.0 147.8L169.1 150.0L170.6 152.2L172.1 154.5L173.6 156.8L175.1 159.8L176.2 162.0L177.0 164.2L178.1 166.5L178.1 168.8L177.8 171.8L178.1 174.0L178.5 176.2L178.9 178.5L180.0 180.8L180.8 183.8L181.9 186.0L181.9 188.2L183.4 190.5L195.8 190.5L194.6 188.2L194.6 186.0L193.5 183.8L192.4 180.8L192.0 178.5L197.6 176.2L195.8 174.0L194.2 171.8L191.2 168.8L187.9 166.5L184.9 164.2L184.5 162.0L183.8 159.8L183.0 156.8L182.2 154.5L181.9 152.2L181.5 150.0L181.1 147.8L181.1 144.8L180.4 142.5L180.4 140.2L180.0 138.0L179.2 135.8L178.5 132.8L177.0 130.5L176.2 128.2L174.8 126.0L172.5 123.8Z' },
    { muscle: 'hamstrings', d: 'M89.2 178.5L88.9 180.8L88.1 183.0L87.8 185.2L87.0 187.5L86.6 189.8L86.6 192.0L86.2 194.2L85.9 196.5L85.9 198.8L85.9 201.0L85.9 203.2L85.9 205.5L85.9 207.7L86.2 210.0L86.2 212.2L86.6 214.5L87.0 216.8L87.8 219.0L89.6 221.2L89.6 223.5L89.6 225.8L89.6 228.0L89.6 230.2L89.6 232.5L89.2 234.8L88.9 237.0L88.9 239.2L88.5 241.5L102.8 244.5L103.1 244.5L103.1 241.5L103.5 239.2L103.9 237.0L104.2 234.8L104.2 232.5L105.0 230.2L105.0 228.0L105.8 225.8L105.8 223.5L106.1 221.2L106.5 219.0L106.9 216.8L107.2 214.5L107.6 212.2L108.0 210.0L107.6 207.7L108.0 205.5L108.0 203.2L108.0 201.0L108.0 198.8L107.6 196.5L107.2 194.2L106.5 192.0L105.4 189.8L94.5 187.5L92.6 185.2L91.1 183.0L90.0 180.8L89.2 178.5Z' },
    { muscle: 'hamstrings', d: 'M150.0 178.5L149.2 180.8L148.5 183.0L146.6 185.2L145.1 187.5L134.2 189.8L133.1 192.0L132.4 194.2L131.6 196.5L131.6 198.8L131.2 201.0L131.2 203.2L131.2 205.5L131.2 207.7L131.6 210.0L131.6 212.2L132.0 214.5L132.4 216.8L132.8 219.0L133.1 221.2L133.5 223.5L133.9 225.8L134.2 228.0L134.6 230.2L135.0 232.5L135.4 234.8L135.4 237.0L135.8 239.2L136.1 241.5L136.5 243.8L136.9 243.8L150.8 241.5L150.8 239.2L150.4 237.0L150.0 234.8L150.0 232.5L150.0 230.2L149.6 228.0L149.6 225.8L149.6 223.5L151.9 221.2L152.2 219.0L152.6 216.8L153.0 214.5L153.0 212.2L153.4 210.0L153.4 207.7L153.8 205.5L153.8 203.2L153.8 201.0L153.8 198.8L153.4 196.5L153.0 194.2L153.0 192.0L152.6 189.8L152.2 187.5L151.9 185.2L150.8 183.0L150.8 180.8L150.0 178.5Z' },
    { muscle: 'adductors', d: 'M116.8 183.8L114.8 186.0L110.8 188.1L106.8 189.8L108.9 194.0L108.5 195.4L109.4 199.2L109.4 208.0L109.0 209.5L109.0 211.8L108.5 213.4L108.9 214.9L107.9 218.5L107.9 220.0L107.0 222.3L107.0 223.9L106.4 227.5L106.4 229.1L106.0 231.3L105.5 232.9L106.2 236.5L106.8 236.5L108.1 229.2L108.5 227.7L108.5 226.2L109.3 224.0L110.0 220.2L110.7 217.2L111.5 215.1L112.3 213.6L112.6 212.0L113.4 209.7L113.7 208.2L114.5 206.1L114.9 204.6L115.6 203.1L116.0 200.7L117.5 194.0L118.0 191.6L118.0 188.6L118.3 186.4L118.3 185.0L118.8 182.8L117.5 182.8Z' },
    { muscle: 'adductors', d: 'M121.0 185.1L121.0 186.8L121.7 190.6L121.7 192.0L122.0 194.2L122.0 195.8L122.9 199.7L123.5 201.1L123.5 202.6L124.4 204.9L124.7 206.4L125.5 207.9L126.6 211.7L127.4 213.2L127.7 215.4L128.5 217.0L128.9 218.3L129.6 222.2L130.4 223.7L130.7 225.9L131.0 227.3L131.0 228.8L132.5 236.2L133.2 236.2L133.7 232.5L133.7 230.9L133.0 228.7L133.0 227.1L131.8 221.9L131.8 220.5L131.4 218.0L130.7 216.7L131.1 215.2L130.7 213.0L130.7 211.4L130.0 207.7L130.0 199.5L131.4 192.2L132.3 190.3L130.1 188.5L125.2 186.3L123.4 184.8L121.7 182.6Z' },
    { muscle: 'calves', d: 'M95.6 239.2L91.1 242.3L88.9 245.2L87.0 248.2L85.5 252.0L84.8 255.0L84.0 258.0L83.2 261.0L83.2 264.8L83.2 267.8L83.2 270.8L84.0 274.5L85.5 277.5L87.0 280.5L87.8 283.5L85.5 287.2L85.9 290.2L86.2 293.2L86.6 296.2L95.6 296.2L96.0 293.2L96.4 290.2L97.1 287.2L98.2 283.5L99.4 280.5L100.5 277.5L101.2 274.5L102.4 270.8L103.1 267.8L103.1 264.8L103.5 261.0L103.1 258.0L103.1 255.0L102.4 252.0L102.0 248.2L100.9 245.2L99.8 242.3L95.6 239.2Z' },
    { muscle: 'calves', d: 'M137.3 245.4L136.5 248.5L135.1 261.4L135.8 268.2L137.3 275.1L140.7 284.1L141.4 287.8L142.9 293.7L143.4 297.3L153.7 297.3L153.7 293.7L154.5 290.7L154.5 287.6L154.8 283.8L153.4 280.9L155.6 275.1L156.7 271.2L157.1 268.1L157.1 265.1L156.3 258.3L155.6 255.2L153.2 248.3L149.4 242.1L145.8 238.9L142.2 238.9L138.9 242.2Z' },
  ];


  const DETAIL_LABEL_POSITIONS = {
    front: {
      shoulder: { x: 16, y: 72, anchor: 'end', tipX: 78, tipY: 78 },
      chest: { x: 16, y: 100, anchor: 'end', tipX: 100, tipY: 96 },
      biceps: { x: 16, y: 132, anchor: 'end', tipX: 72, tipY: 118 },
      core: { x: 224, y: 148, anchor: 'start', tipX: 150, tipY: 148 },
      forearms: { x: 16, y: 172, anchor: 'end', tipX: 52, tipY: 168 },
      quads: { x: 224, y: 230, anchor: 'start', tipX: 158, tipY: 220 },
      adductors: { x: 224, y: 198, anchor: 'start', tipX: 132, tipY: 205 },
      calves: { x: 224, y: 292, anchor: 'start', tipX: 158, tipY: 292 },
    },
    back: {
      shoulder: { x: 14, y: 64, anchor: 'end', tipX: 78, tipY: 82 },
      back: { x: 14, y: 108, anchor: 'end', tipX: 108, tipY: 112 },
      triceps: { x: 14, y: 152, anchor: 'end', tipX: 70, tipY: 112 },
      forearms: { x: 14, y: 196, anchor: 'end', tipX: 50, tipY: 168 },
      glutes: { x: 226, y: 168, anchor: 'start', tipX: 128, tipY: 178 },
      hamstrings: { x: 226, y: 218, anchor: 'start', tipX: 158, tipY: 230 },
      adductors: { x: 226, y: 262, anchor: 'start', tipX: 128, tipY: 215 },
      calves: { x: 226, y: 308, anchor: 'start', tipX: 158, tipY: 292 },
    },
  };

  let currentView = 'front';
  let currentMode = 'recovery';
  let selectedMuscle = null;
  let isOpen = false;
  let recoveryCache = null;
  let growthCache = null;
  let swipeStartY = null;

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getMuscleOrder() {
    return (typeof MUSCLE_ORDER !== 'undefined') ? MUSCLE_ORDER.slice() : [];
  }

  function getMuscleLabel(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].name;
    }
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getShortName) {
      return MuscleHeatmap.getShortName(muscleKey);
    }
    return muscleKey;
  }

  function getShortName(muscleKey) {
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.SHORT_NAMES) {
      return MuscleHeatmap.SHORT_NAMES[muscleKey] || getMuscleLabel(muscleKey);
    }
    return getMuscleLabel(muscleKey);
  }

  function getIcon(muscleKey) {
    if (typeof MUSCLE_LABELS !== 'undefined' && MUSCLE_LABELS[muscleKey]) {
      return MUSCLE_LABELS[muscleKey].icon || '🎯';
    }
    return '🎯';
  }

  function assetUrl(path) {
    return `${path}?v=${ASSET_VERSION}`;
  }

  function getBodyImage(view) {
    const images = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_IMAGES)
      || { front: 'body-map-front.png', back: 'body-map-back.png' };
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getBodyImageSrc) {
      return MuscleHeatmap.getBodyImageSrc(view);
    }
    return assetUrl(images[view] || images.front);
  }

  function getBodyMask(view) {
    const masks = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.BODY_MASKS)
      || { front: 'body-mask-front.png', back: 'body-mask-back.png' };
    return assetUrl(masks[view] || masks.front);
  }

  function getFrontRegions() {
    return DETAIL_FRONT_REGIONS;
  }

  function getBackRegions() {
    // Exclusive art-aligned set (includes traps/lats/lower/glutes splits).
    return DETAIL_BACK_REGIONS;
  }

  function getLabelPositions(view) {
    return DETAIL_LABEL_POSITIONS[view] || {};
  }

  function resolveDataKey(labelOrMuscle) {
    return LABEL_DATA_KEY[labelOrMuscle] || labelOrMuscle;
  }

  function musclesForView(view) {
    return (VIEW_MUSCLES[view] || VIEW_MUSCLES.front).slice();
  }

  function pickDefaultMuscle(view) {
    const allowed = new Set(musclesForView(view));
    const rows = buildSortedList().filter((r) => allowed.has(r.muscle));
    if (!rows.length) return musclesForView(view)[0] || null;
    // Prefer a muscle that has a signal on this side; else first in sorted list.
    const signaled = rows.find((r) => r.hasSignal);
    return (signaled || rows[0]).muscle;
  }

  function ensureSelectionForView(view) {
    const allowed = new Set(musclesForView(view));
    if (!selectedMuscle || !allowed.has(selectedMuscle)) {
      selectedMuscle = pickDefaultMuscle(view);
    }
  }

  function loadWorkoutsSafe() {
    try { return (typeof loadWorkouts === 'function') ? loadWorkouts() : []; }
    catch (e) { return []; }
  }

  function loadSettingsSafe() {
    try { return (typeof loadSettings === 'function') ? loadSettings() : {}; }
    catch (e) { return {}; }
  }

  function refreshCaches() {
    try {
      if (typeof calcMuscleRecovery === 'function') {
        recoveryCache = calcMuscleRecovery(loadWorkoutsSafe(), loadSettingsSafe());
      }
    } catch (e) {
      recoveryCache = recoveryCache || {};
    }
    try {
      if (typeof MuscleGrowthTracker !== 'undefined' && MuscleGrowthTracker.compute) {
        growthCache = MuscleGrowthTracker.compute(loadWorkoutsSafe(), new Date());
      }
    } catch (e) {
      growthCache = growthCache || null;
    }
  }

  function resolveMode(preferred) {
    if (preferred === 'recovery' || preferred === 'growth' || preferred === 'loss') return preferred;
    if (typeof Heatmap3dModes !== 'undefined' && Heatmap3dModes.getState) {
      const m = Heatmap3dModes.getState().mode;
      if (m === 'recovery' || m === 'growth' || m === 'loss') return m;
    }
    return 'recovery';
  }

  function formatDateKo(dateStr) {
    if (!dateStr) return '기록 없음';
    const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  function formatVolume(vol) {
    if (vol == null || !(vol > 0)) return '최근 볼륨 없음';
    const n = Math.round(vol);
    return `최근 볼륨 ${n.toLocaleString('ko-KR')}`;
  }

  function hasBatchim(word) {
    const ch = String(word || '').slice(-1);
    const code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  }

  function withTopic(name) {
    return `${name}${hasBatchim(name) ? '은' : '는'}`;
  }

  function withObject(name) {
    return `${name}${hasBatchim(name) ? '을' : '를'}`;
  }

  function getRecoveryEntry(muscle) {
    return (recoveryCache && recoveryCache[muscle]) || null;
  }

  function getGrowthEntry(muscle) {
    const per = growthCache && growthCache.perMuscle;
    return (per && per[muscle] && per[muscle].growth) || null;
  }

  function getLossEntry(muscle) {
    const per = growthCache && growthCache.perMuscle;
    return (per && per[muscle] && per[muscle].loss) || null;
  }

  function getRow(muscle) {
    const rec = getRecoveryEntry(muscle);
    const growth = getGrowthEntry(muscle);
    const loss = getLossEntry(muscle);
    const lastDate = rec && rec.lastDate != null ? rec.lastDate : null;
    const volume = rec && rec.volume > 0
      ? rec.volume
      : (growth && growth.recentAvgVolume > 0 ? growth.recentAvgVolume : null);

    if (currentMode === 'growth') {
      const pct = growth && growth.growthPct != null ? growth.growthPct : 0;
      return {
        muscle,
        pct,
        hasSignal: !!(growth && growth.growthPct > 0),
        lastDate,
        volume: (growth && growth.recentAvgVolume) || volume,
        sessions: growth ? growth.sessionCount : 0,
        daysSince: loss ? loss.daysSince : null,
        sortKey: pct,
      };
    }
    if (currentMode === 'loss') {
      const pct = loss && loss.lossPct != null ? loss.lossPct : 0;
      return {
        muscle,
        pct,
        hasSignal: !!(loss && loss.lossPct > 0),
        lastDate,
        volume,
        sessions: growth ? growth.sessionCount : 0,
        daysSince: loss ? loss.daysSince : null,
        sortKey: pct,
      };
    }
    const hasData = !!(rec && rec.lastDate != null);
    const pct = hasData ? (rec.recoveryPct != null ? rec.recoveryPct : 100) : null;
    return {
      muscle,
      pct: pct == null ? 100 : pct,
      hasSignal: hasData,
      lastDate,
      volume: rec ? rec.volume : null,
      hoursLeft: hasData && typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getHoursUntilReady
        ? MuscleHeatmap.getHoursUntilReady(muscle, recoveryCache)
        : null,
      sortKey: hasData ? pct : 101,
    };
  }

  function buildTip(row) {
    const name = getMuscleLabel(row.muscle);
    if (currentMode === 'growth') {
      if (row.hasSignal && row.pct >= 1.5) {
        return `${withTopic(name)} 요즘 잘 자극되고 있어요. 지금 페이스를 유지해 보세요.`;
      }
      if (row.hasSignal) {
        return `${name}에 성장 신호가 있어요. 세션을 조금 더 꾸준히 쌓아 보세요.`;
      }
      return `${withTopic(name)} 최근 성장 신호가 약해요. 자극을 조금 늘려 보세요.`;
    }
    if (currentMode === 'loss') {
      if (row.hasSignal && row.pct >= 4) {
        return `${withObject(name)} 오래 쉬었어요. 가벼운 무게부터 다시 시작해 보세요.`;
      }
      if (row.hasSignal) {
        return `${name}에 손실 신호가 보여요. 이번 주에 한 번만 자극해도 좋아요.`;
      }
      return `${withTopic(name)} 잘 유지되고 있어요. 지금처럼 이어 가면 됩니다.`;
    }
    if (!row.hasSignal) {
      return `${name} 기록이 아직 없어요. 운동을 남기면 회복 상태를 볼 수 있어요.`;
    }
    if (row.pct < 40) {
      return `${withTopic(name)} 아직 피곤해요. 충분히 쉰 뒤 다시 자극하세요.`;
    }
    if (row.pct < 95) {
      return `${withTopic(name)} 회복 중이에요. 무리하지 말고 상태를 봐 주세요.`;
    }
    return `${withTopic(name)} 준비됐어요. 오늘 운동해도 좋아요.`;
  }

  function formatValueLabel(row) {
    if (currentMode === 'growth') {
      return row.hasSignal ? `성장 +${row.pct}%` : '성장 신호 없음';
    }
    if (currentMode === 'loss') {
      return row.hasSignal ? `손실 −${row.pct}%` : '손실 없음';
    }
    if (!row.hasSignal) return '기록 없음';
    return `회복 ${row.pct}%`;
  }

  function formatValueColor(row) {
    if (currentMode === 'growth') {
      if (!row.hasSignal) return 'var(--muted)';
      return row.pct >= STRONG_GROWTH_PCT ? GROWTH_LIME : GROWTH_TEAL;
    }
    if (currentMode === 'loss') {
      return row.hasSignal ? (row.pct >= STRONG_LOSS_PCT ? LOSS_INDIGO : LOSS_VIOLET) : 'var(--muted)';
    }
    if (!row.hasSignal) return 'var(--muted)';
    if (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getRecoveryColor) {
      return MuscleHeatmap.getRecoveryColor(row.pct, true);
    }
    if (row.pct < 40) return '#ff3b5c';
    if (row.pct < 95) return '#f5a524';
    return '#3ee6b0';
  }

  function recoveryStatusClass(row) {
    // Do NOT use mh-region--idle — global CSS forces fill:transparent !important.
    if (!row.hasSignal) return '';
    if (row.pct < 40) return 'mh-region--low';
    if (row.pct < 95) return 'mh-region--mid';
    return 'mh-region--ready';
  }

  function getFill(row) {
    if (currentMode === 'growth') {
      // No growth signal → leave silhouette unpainted (neutral), matching 3D unlit.
      if (!row.hasSignal) return { fill: '#1e1e26', opacity: 0 };
      const strong = row.pct >= STRONG_GROWTH_PCT;
      return { fill: strong ? GROWTH_LIME : GROWTH_TEAL, opacity: 0.5 + Math.min(0.35, row.pct / 3 * 0.35) };
    }
    if (currentMode === 'loss') {
      if (!row.hasSignal) return { fill: '#3a3a44', opacity: 0 };
      const deep = row.pct >= STRONG_LOSS_PCT;
      return { fill: deep ? LOSS_INDIGO : LOSS_VIOLET, opacity: 0.5 + Math.min(0.35, row.pct / 8 * 0.35) };
    }
    if (!row.hasSignal) {
      // Recovery: neutral grey only — not a status color.
      return { fill: (MuscleHeatmap && MuscleHeatmap.IDLE_FILL) || '#2c2c36', opacity: 0.22 };
    }
    const color = (typeof MuscleHeatmap !== 'undefined' && MuscleHeatmap.getRecoveryColor)
      ? MuscleHeatmap.getRecoveryColor(row.pct, true)
      : formatValueColor(row);
    return { fill: color, opacity: 0.82 };
  }

  function buildRegionPaths(view) {
    const regions = view === 'back' ? getBackRegions() : getFrontRegions();
    return regions.map((region) => {
      const row = getRow(region.muscle);
      const { fill, opacity } = getFill(row);
      const label = getMuscleLabel(region.muscle);
      const painted = opacity > 0.02;
      // White selection stroke on transparent paths reads as empty white bars — skip it.
      const selected = (selectedMuscle === region.muscle && painted) ? ' hbmd-region--selected' : '';
      // Skip mh-region--low/mid/ready: global drop-shadow filters make fills look like
      // small floating blobs that no longer match the silhouette outlines.
      const stroke = painted ? REGION_STROKE : 'none';
      const sw = painted ? REGION_STROKE_W : 0;
      // Inline fill must win over global .mh-region--idle { fill:transparent !important }
      const style = `fill:${fill};fill-opacity:${opacity};filter:none`;
      return `<path class="hbmd-region${selected}" data-muscle="${region.muscle}"
        d="${region.d}" style="${style}"
        stroke="${stroke}" stroke-width="${sw}" pointer-events="all">
        <title>${escapeHtml(label)} · ${escapeHtml(formatValueLabel(row))}</title>
      </path>`;
    }).join('');
  }

  function getLabelShortName(labelId) {
    if (DETAIL_SHORT_NAMES[labelId]) return DETAIL_SHORT_NAMES[labelId];
    return getShortName(resolveDataKey(labelId));
  }

  /**
   * Pack callout labels on left (anchor end) / right (anchor start) columns
   * so name+pct stacks do not overlap at ~390px sheet width.
   */
  function packLabelLayouts(entries) {
    const bySide = { left: [], right: [] };
    entries.forEach((e) => {
      const side = (e.pos.anchor === 'start') ? 'right' : 'left';
      bySide[side].push({ ...e, side, y: e.pos.y });
    });
    ['left', 'right'].forEach((side) => {
      const list = bySide[side].sort((a, b) => a.y - b.y);
      let prevBottom = -Infinity;
      list.forEach((item) => {
        const minY = prevBottom + LABEL_LINE_H / 2 + LABEL_MIN_GAP;
        if (item.y < minY) item.y = minY;
        // Keep inside viewBox with padding for the two-line stack
        item.y = Math.max(28, Math.min(340, item.y));
        prevBottom = item.y + LABEL_LINE_H / 2;
      });
      // If bottom overflowed, pull the column up while keeping gaps
      const last = list[list.length - 1];
      if (last && last.y > 340) {
        const overflow = last.y - 340;
        list.forEach((item) => { item.y -= overflow; });
        let prev = -Infinity;
        list.forEach((item) => {
          const minY = prev + LABEL_LINE_H / 2 + LABEL_MIN_GAP;
          if (item.y < minY) item.y = minY;
          item.y = Math.max(28, item.y);
          prev = item.y + LABEL_LINE_H / 2;
        });
      }
    });
    return bySide.left.concat(bySide.right);
  }

  function buildRegionLabels(view) {
    const positions = getLabelPositions(view);
    const labeled = new Set();
    const entries = [];
    Object.keys(positions).forEach((labelId) => {
      if (labeled.has(labelId)) return;
      labeled.add(labelId);
      const dataKey = resolveDataKey(labelId);
      const row = getRow(dataKey);
      if (!row.hasSignal) return;
      entries.push({ labelId, dataKey, row, pos: positions[labelId] });
    });
    const packed = packLabelLayouts(entries);
    return packed.map((item) => {
      const { labelId, dataKey, row, pos, y } = item;
      const name = getLabelShortName(labelId);
      const anchor = pos.anchor || 'middle';
      const tipX = pos.tipX != null ? pos.tipX : pos.x;
      const tipY = pos.tipY != null ? pos.tipY : pos.y;
      const midX = anchor === 'end' ? pos.x + 8 : (anchor === 'start' ? pos.x - 8 : pos.x);
      const pctText = currentMode === 'growth'
        ? `+${row.pct}%`
        : (currentMode === 'loss' ? `−${row.pct}%` : `${row.pct}%`);
      // Inline fill beats global `.mh-region-pct { fill:#3ee6b0 }` so loss/growth match legend.
      const pctColor = formatValueColor(row);
      return `<g class="mh-label-group" data-muscle="${dataKey}" data-label-id="${labelId}" pointer-events="none">
          <path class="mh-label-leader" d="M${pos.x} ${y} L${midX} ${y} L${tipX} ${tipY}"/>
          <text x="${pos.x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"
            class="mh-region-label mh-region-label--active">
            <tspan x="${pos.x}" dy="-6" class="mh-region-name">${escapeHtml(name)}</tspan>
            <tspan x="${pos.x}" dy="13" class="mh-region-pct" style="fill:${pctColor}">${escapeHtml(pctText)}</tspan>
          </text>
        </g>`;
    }).join('');
  }

  function buildSvg(view) {
    const img = getBodyImage(view);
    const mask = getBodyMask(view);
    // SVG <mask> must use userSpaceOnUse for BOTH units. Default maskUnits=
    // objectBoundingBox sizes the mask to the path-group bbox — that shrinks and
    // shifts fills upward vs the body outline image (same viewBox 240×360).
    // Also avoid CSS mask-image on <g> (same bbox bug).
    const maskId = `hbmdMask-${view}`;
    // Do NOT reuse class "mh-svg" — home CSS caps max-height at 42vh/360px which
    // distorts the CSS viewport vs viewBox and makes fills look shifted/undersized.
    return `<svg class="hbmd-svg" viewBox="0 0 240 360" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(MODE_TITLES[currentMode])} ${view === 'back' ? '후면' : '전면'}">
      <defs>
        <mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
          x="0" y="0" width="240" height="360">
          <image href="${mask}" x="0" y="0" width="240" height="360"
            preserveAspectRatio="xMidYMid meet"/>
        </mask>
      </defs>
      <image class="mh-body-image" href="${img}" x="0" y="0" width="240" height="360"
        preserveAspectRatio="xMidYMid meet" pointer-events="none"></image>
      <g class="hbmd-muscles" mask="url(#${maskId})">
        ${buildRegionPaths(view)}
      </g>
      <g class="hbmd-labels" aria-hidden="false">
        ${buildRegionLabels(view)}
      </g>
    </svg>`;
  }

  function buildSortedList() {
    const rows = getMuscleOrder().map(getRow);
    if (currentMode === 'recovery') {
      rows.sort((a, b) => {
        if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
        return a.sortKey - b.sortKey;
      });
    } else {
      rows.sort((a, b) => {
        if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
        return b.sortKey - a.sortKey;
      });
    }
    return rows;
  }

  // 홈(ExerciseStimHeatmap)과 같은 부위→추천 운동 시트를 재사용.
  // 자세히 보기 시트가 z-index 1300이라, 열린 동안 esh 오버레이를 더 위로 올린다.
  function openMuscleExercises(muscleKey) {
    if (!muscleKey) return false;
    if (typeof ExerciseStimHeatmap !== 'undefined' && typeof ExerciseStimHeatmap.openMuscle === 'function') {
      ExerciseStimHeatmap.openMuscle(muscleKey);
      return true;
    }
    return false;
  }

  function applyListSelection(muscleKey, opts) {
    selectedMuscle = resolveDataKey(muscleKey);
    const frontSet = new Set(musclesForView('front'));
    const backSet = new Set(musclesForView('back'));
    if (currentView === 'back' && frontSet.has(selectedMuscle) && !backSet.has(selectedMuscle)) {
      currentView = 'front';
    } else if (currentView === 'front' && backSet.has(selectedMuscle) && !frontSet.has(selectedMuscle)) {
      currentView = 'back';
    }
    renderSheet();
    const overlay = document.getElementById(OVERLAY_ID);
    const detail = overlay && overlay.querySelector('[data-hbmd-detail]');
    if (detail && detail.scrollIntoView) {
      detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (!opts || opts.openExercises !== false) openMuscleExercises(selectedMuscle);
    return selectedMuscle;
  }

  function buildDetailCard(muscle) {
    if (!muscle) {
      return `<div class="hbmd-detail hbmd-detail--empty" data-hbmd-detail>
        지도를 탭하면 부위별 수치와 안내가 여기에 보여요.
      </div>`;
    }
    const row = getRow(muscle);
    const name = getMuscleLabel(muscle);
    const last = formatDateKo(row.lastDate);
    const vol = formatVolume(row.volume);
    const tip = buildTip(row);
    const value = formatValueLabel(row);
    const color = formatValueColor(row);
    const extra = currentMode === 'growth' && row.sessions
      ? `<div class="hbmd-meta">최근 4주 세션 ${row.sessions}회</div>`
      : (currentMode === 'loss' && row.daysSince != null
        ? `<div class="hbmd-meta">${row.daysSince}일째 미훈련</div>`
        : (currentMode === 'recovery' && row.hoursLeft != null && row.hoursLeft > 0
          ? `<div class="hbmd-meta">준비까지 약 ${row.hoursLeft}시간</div>`
          : ''));
    return `<div class="hbmd-detail" data-hbmd-detail data-muscle="${escapeHtml(muscle)}">
      <div class="hbmd-detail-top">
        <div class="hbmd-detail-icon">${getIcon(muscle)}</div>
        <div class="hbmd-detail-main">
          <div class="hbmd-detail-name">${escapeHtml(name)}</div>
          <div class="hbmd-detail-value" style="color:${color}">${escapeHtml(value)}</div>
        </div>
      </div>
      <div class="hbmd-meta">마지막 훈련 · ${escapeHtml(last)}</div>
      <div class="hbmd-meta">${escapeHtml(vol)}</div>
      ${extra}
      <p class="hbmd-tip">${escapeHtml(tip)}</p>
    </div>`;
  }

  function buildListHtml() {
    const rows = buildSortedList();
    return rows.map((row) => {
      const name = getMuscleLabel(row.muscle);
      const color = formatValueColor(row);
      const value = formatValueLabel(row);
      const sub = row.lastDate
        ? `마지막 훈련 ${formatDateKo(row.lastDate)}`
        : '아직 훈련 기록 없음';
      const sel = selectedMuscle === row.muscle ? ' hbmd-list-item--selected' : '';
      return `<button type="button" class="hbmd-list-item${sel}" data-hbmd-muscle="${row.muscle}" aria-label="${escapeHtml(name)} ${escapeHtml(value)}">
        <span class="hbmd-list-icon" aria-hidden="true">${getIcon(row.muscle)}</span>
        <span class="hbmd-list-main">
          <span class="hbmd-list-name">${escapeHtml(name)}</span>
          <span class="hbmd-list-sub">${escapeHtml(sub)}</span>
        </span>
        <span class="hbmd-list-pct" style="color:${color}">${escapeHtml(value)}</span>
      </button>`;
    }).join('');
  }

  function legendHtml() {
    if (currentMode === 'growth') {
      return `<span><i style="background:#1aa88a"></i>성장 중</span>
        <span><i style="background:#b8ff3d"></i>강한 성장</span>
        <span><i style="background:#1e1e26"></i>신호 없음</span>`;
    }
    if (currentMode === 'loss') {
      return `<span><i style="background:${LOSS_VIOLET}"></i>손실</span>
        <span><i style="background:${LOSS_INDIGO}"></i>손실 심함</span>
        <span><i style="background:#3a3a44"></i>유지</span>`;
    }
    return `<span><i style="background:#ff3b5c"></i>피로</span>
      <span><i style="background:#f5a524"></i>회복 중</span>
      <span><i style="background:#3ee6b0"></i>준비됨</span>`;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_WRAP_ID} {
        display: flex; justify-content: center; padding: 10px 12px 4px;
      }
      .hbmd-open-btn {
        min-height: ${MIN_TAP}px; min-width: ${MIN_TAP}px;
        padding: 0 18px; border-radius: 12px;
        border: 1px solid var(--border, #2a2a36);
        background: var(--card, #16161f); color: var(--text, #eee);
        font-size: 14px; font-weight: 700; letter-spacing: -0.02em;
        cursor: pointer; touch-action: manipulation;
        width: 100%; max-width: 420px;
      }
      .hbmd-open-btn:active { opacity: 0.85; }
      .hbmd-overlay {
        display: none; position: fixed; inset: 0; z-index: 1300;
        background: rgba(0,0,0,0.62);
        align-items: stretch; justify-content: center;
        overscroll-behavior: contain;
      }
      .hbmd-overlay.show { display: flex; animation: fadeIn 0.18s ease; }
      body.hbmd-detail-open #eshMuscleOverlay { z-index: 1400; }
      body.hbmd-detail-open #eshExerciseOverlay { z-index: 1410; }
      .hbmd-sheet {
        width: min(560px, 100%); height: 100%; max-height: 100%;
        background: var(--bg, #0c0c12); color: var(--text, #eee);
        border: none; border-radius: 0;
        display: flex; flex-direction: column;
        overflow: hidden; touch-action: pan-y;
        overscroll-behavior: contain;
        padding: env(safe-area-inset-top, 0) 0 env(safe-area-inset-bottom, 0);
      }
      .hbmd-sheet-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 14px; flex-shrink: 0;
        border-bottom: 1px solid var(--border, #2a2a36);
        min-height: ${MIN_TAP}px;
        touch-action: none;
      }
      .hbmd-sheet-kicker { font-size: 11px; color: var(--muted); font-weight: 600; }
      .hbmd-sheet-title { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; word-break: keep-all; }
      .hbmd-sheet-close {
        min-width: ${MIN_TAP}px; min-height: ${MIN_TAP}px;
        border: none; border-radius: 12px; padding: 0 14px;
        background: var(--card, #16161f); color: var(--muted);
        font-size: 13px; font-weight: 700; cursor: pointer;
        touch-action: manipulation;
      }
      .hbmd-sheet-body {
        flex: 1; overflow: auto; -webkit-overflow-scrolling: touch;
        touch-action: pan-y; overscroll-behavior: contain;
        padding: 12px 14px 24px;
      }
      .hbmd-view-toggle {
        display: inline-flex; gap: 6px; margin: 0 0 10px;
        background: var(--card, #16161f); border-radius: 12px; padding: 4px;
        border: 1px solid var(--border, #2a2a36);
      }
      .hbmd-view-btn {
        min-height: ${MIN_TAP}px; min-width: 72px; padding: 0 14px;
        border: none; border-radius: 10px; background: transparent;
        color: var(--muted); font-weight: 700; font-size: 13px;
        cursor: pointer; touch-action: manipulation;
      }
      .hbmd-view-btn.selected { background: rgba(255,255,255,0.08); color: var(--text); }
      .hbmd-map-wrap {
        position: relative; display: flex; justify-content: center;
        margin: 0 auto 10px; max-width: 280px; width: 100%;
      }
      .hbmd-svg {
        width: 100%; height: auto; display: block;
        overflow: visible; max-width: 100%;
        max-height: none !important; /* beat .mh-svg max-height if class leaks */
        aspect-ratio: 240 / 360;
      }
      .hbmd-muscles { /* fills share SVG user space with body image — no CSS mask */ }
      .hbmd-region {
        vector-effect: non-scaling-stroke;
        filter: none !important; /* no home heatmap glow on detail fills */
      }
      .hbmd-region--selected { stroke: #fff !important; stroke-width: 2px; }
      .hbmd-svg .mh-region-label { font-size: 9.5px; }
      .hbmd-svg .mh-region-name { font-weight: 800; }
      /* Override global mint-only pct color — inline style on tspan sets the real fill */
      .hbmd-overlay .hbmd-svg .mh-region-pct { font-weight: 800; font-size: 8.5px; }
      .hbmd-overlay .hbmd-svg .mh-label-leader {
        stroke: rgba(240,240,245,0.35); stroke-width: 1px; fill: none;
      }
      /* Keep recovery glow but never let idle !important wipe detail fills */
      .hbmd-overlay .hbmd-svg .mh-region.mh-region--idle {
        fill: unset;
        fill-opacity: unset;
      }
      .hbmd-legend {
        display: flex; flex-wrap: wrap; gap: 10px 14px; justify-content: center;
        font-size: 11px; color: var(--muted); margin: 0 0 12px; word-break: keep-all;
      }
      .hbmd-legend i {
        display: inline-block; width: 9px; height: 9px; border-radius: 50%;
        margin-right: 5px; vertical-align: middle;
      }
      .hbmd-detail {
        background: var(--card, #16161f); border: 1px solid var(--border, #2a2a36);
        border-radius: 14px; padding: 12px 14px; margin-bottom: 14px;
        word-break: keep-all;
      }
      .hbmd-detail--empty { color: var(--muted); font-size: 13px; text-align: center; }
      .hbmd-detail-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .hbmd-detail-icon { font-size: 22px; }
      .hbmd-detail-name { font-size: 16px; font-weight: 800; }
      .hbmd-detail-value { font-size: 14px; font-weight: 800; margin-top: 2px; }
      .hbmd-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
      .hbmd-tip {
        margin: 10px 0 0; font-size: 13.5px; line-height: 1.45; font-weight: 600;
        word-break: keep-all;
      }
      .hbmd-list-title {
        font-size: 13px; font-weight: 800; margin: 4px 0 8px; word-break: keep-all;
      }
      .hbmd-list { display: flex; flex-direction: column; gap: 8px; }
      .hbmd-list-item {
        display: flex; align-items: center; gap: 10px;
        min-height: ${MIN_TAP}px; width: 100%; text-align: left;
        padding: 10px 12px; border-radius: 12px;
        border: 1px solid var(--border, #2a2a36);
        background: var(--card, #16161f); color: inherit;
        cursor: pointer; touch-action: manipulation;
      }
      .hbmd-list-item--selected { outline: 1.5px solid rgba(62,230,176,0.55); }
      .hbmd-list-icon { font-size: 18px; flex-shrink: 0; }
      .hbmd-list-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .hbmd-list-name { font-size: 13.5px; font-weight: 700; word-break: keep-all; }
      .hbmd-list-sub { font-size: 10.5px; color: var(--muted); margin-top: 2px; word-break: keep-all; }
      .hbmd-list-pct { font-size: 13px; font-weight: 800; flex-shrink: 0; word-break: keep-all; }
      .hbmd-footnote {
        margin-top: 12px; font-size: 11px; color: var(--muted); line-height: 1.4;
        word-break: keep-all;
      }
      @media (prefers-reduced-motion: reduce) {
        .hbmd-overlay.show { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.className = 'hbmd-overlay';
      overlay.setAttribute('role', 'presentation');
      document.body.appendChild(overlay);
    }
    if (overlay.getAttribute('data-hbmd-wired') !== '1') {
      overlay.setAttribute('data-hbmd-wired', '1');
      overlay.classList.add('hbmd-overlay');
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }
    return overlay;
  }

  function bindSwipe(header) {
    if (!header) return;
    const onStart = (e) => {
      const t = e.touches && e.touches[0];
      swipeStartY = t ? t.clientY : null;
    };
    const onMove = (e) => {
      if (swipeStartY == null) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - swipeStartY;
      if (dy > 90) {
        swipeStartY = null;
        close();
      }
    };
    const onEnd = () => { swipeStartY = null; };
    header.addEventListener('touchstart', onStart, { passive: true });
    header.addEventListener('touchmove', onMove, { passive: true });
    header.addEventListener('touchend', onEnd, { passive: true });
    header.addEventListener('touchcancel', onEnd, { passive: true });
  }

  function renderSheet() {
    const overlay = ensureOverlay();
    const title = MODE_TITLES[currentMode] || '자세히 보기';
    const kicker = MODE_KICKERS[currentMode] || '';
    overlay.innerHTML = `
      <div class="hbmd-sheet" role="dialog" aria-modal="true" aria-labelledby="hbmdTitle" onclick="event.stopPropagation()">
        <div class="hbmd-sheet-header" data-hbmd-header>
          <div>
            <div class="hbmd-sheet-kicker">${escapeHtml(kicker)} · 2D 상세</div>
            <div class="hbmd-sheet-title" id="hbmdTitle">${escapeHtml(title)}</div>
          </div>
          <button type="button" class="hbmd-sheet-close" data-hbmd-close aria-label="닫기">닫기</button>
        </div>
        <div class="hbmd-sheet-body" data-hbmd-body>
          <div class="hbmd-view-toggle" role="group" aria-label="전면 후면">
            <button type="button" class="hbmd-view-btn ${currentView === 'front' ? 'selected' : ''}" data-hbmd-view="front">전면</button>
            <button type="button" class="hbmd-view-btn ${currentView === 'back' ? 'selected' : ''}" data-hbmd-view="back">후면</button>
          </div>
          <div class="hbmd-map-wrap" data-hbmd-map>${buildSvg(currentView)}</div>
          <div class="hbmd-legend">${legendHtml()}</div>
          ${buildDetailCard(selectedMuscle)}
          <div class="hbmd-list-title">부위별 수치 목록</div>
          <div class="hbmd-list" data-hbmd-list>${buildListHtml()}</div>
          <p class="hbmd-footnote">3D는 참고용이에요. 숫자는 훈련 기록으로 계산한 추정치이며 체성분 실측이 아닙니다.</p>
        </div>
      </div>`;

    const closeBtn = overlay.querySelector('[data-hbmd-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => close());

    overlay.querySelectorAll('[data-hbmd-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-hbmd-view') === 'back' ? 'back' : 'front';
        if (next === currentView) return;
        currentView = next;
        ensureSelectionForView(currentView);
        renderSheet();
      });
    });

    const map = overlay.querySelector('[data-hbmd-map]');
    if (map) {
      map.addEventListener('click', (e) => {
        const region = e.target.closest('[data-muscle]');
        if (!region) return;
        const key = region.getAttribute('data-muscle');
        applyListSelection(key);
      });
    }

    overlay.querySelectorAll('[data-hbmd-muscle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyListSelection(btn.getAttribute('data-hbmd-muscle'));
      });
    });

    bindSwipe(overlay.querySelector('[data-hbmd-header]'));
  }

  function open(mode) {
    ensureStyles();
    refreshCaches();
    currentMode = resolveMode(mode);
    currentView = 'front';
    selectedMuscle = null;
    ensureSelectionForView(currentView);
    renderSheet();
    const overlay = ensureOverlay();
    overlay.classList.add('show');
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('hbmd-detail-open');
    }
    isOpen = true;
  }

  function close(opts) {
    if (!isOpen && !document.getElementById(OVERLAY_ID)) return;
    isOpen = false;
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('show');
      overlay.innerHTML = '';
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('hbmd-detail-open');
    }
    if (typeof ExerciseStimHeatmap !== 'undefined' && ExerciseStimHeatmap.closeMuscle) {
      try { ExerciseStimHeatmap.closeMuscle(); } catch (e) { /* ignore */ }
    }
  }

  function ensureOpenButton() {
    ensureStyles();
    const host = document.getElementById('heatmapModeHost');
    const shared = document.getElementById('h3dSharedHost');
    if (!host || !shared) return null;

    let wrap = document.getElementById(BTN_WRAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = BTN_WRAP_ID;
      if (shared.nextSibling) host.insertBefore(wrap, shared.nextSibling);
      else host.appendChild(wrap);
    }
    if (!wrap.querySelector('[data-hbmd-open]')) {
      wrap.innerHTML = `<button type="button" class="hbmd-open-btn" data-hbmd-open aria-label="자세히 보기">자세히 보기</button>`;
      const btn = wrap.querySelector('[data-hbmd-open]');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
    }
    return wrap;
  }

  function afterHomeRender() {
    ensureOpenButton();
  }

  // Test helpers
  function buildTipForTest(mode, row) {
    const prev = currentMode;
    currentMode = mode;
    const tip = buildTip(row);
    currentMode = prev;
    return tip;
  }

  function formatValueColorForTest(mode, row) {
    const prev = currentMode;
    currentMode = mode;
    const color = formatValueColor(row);
    currentMode = prev;
    return color;
  }

  function getFillForTest(mode, row) {
    const prev = currentMode;
    currentMode = mode;
    const fill = getFill(row);
    currentMode = prev;
    return fill;
  }

  function getSortedListForTest(mode, recovery, growth) {
    const prevMode = currentMode;
    const prevRec = recoveryCache;
    const prevGrowth = growthCache;
    currentMode = mode;
    recoveryCache = recovery || {};
    growthCache = growth || null;
    const list = buildSortedList();
    currentMode = prevMode;
    recoveryCache = prevRec;
    growthCache = prevGrowth;
    return list;
  }

  function withTestState(mode, recovery, growth, fn) {
    const prevMode = currentMode;
    const prevRec = recoveryCache;
    const prevGrowth = growthCache;
    const prevView = currentView;
    const prevSel = selectedMuscle;
    currentMode = mode || prevMode;
    if (recovery !== undefined) recoveryCache = recovery || {};
    if (growth !== undefined) growthCache = growth || null;
    const result = fn();
    currentMode = prevMode;
    recoveryCache = prevRec;
    growthCache = prevGrowth;
    currentView = prevView;
    selectedMuscle = prevSel;
    return result;
  }

  /** Every painted region must resolve to a known app muscle key (no stray aliases). */
  function auditRegionMapping() {
    const allowed = new Set(getMuscleOrder());
    const issues = [];
    ['front', 'back'].forEach((view) => {
      const regions = view === 'back' ? getBackRegions() : getFrontRegions();
      regions.forEach((r, i) => {
        if (!allowed.has(r.muscle)) {
          issues.push(`${view}[${i}] unknown muscle key: ${r.muscle}`);
        }
      });
      const positions = getLabelPositions(view);
      Object.keys(positions).forEach((labelId) => {
        const key = resolveDataKey(labelId);
        if (!allowed.has(key)) {
          issues.push(`${view} label '${labelId}' → unknown key: ${key}`);
        }
      });
    });
    return issues;
  }

  function getBackRegionMusclesForTest() {
    return getBackRegions().map((r) => r.muscle);
  }

  function countBackSplitsForTest() {
    return getBackRegions().filter((r) => r.muscle === 'back').length;
  }

  function packLabelsForTest(view, mode, recovery, growth) {
    return withTestState(mode, recovery, growth, () => {
      currentMode = mode;
      const positions = getLabelPositions(view);
      const entries = [];
      Object.keys(positions).forEach((labelId) => {
        const dataKey = resolveDataKey(labelId);
        const row = getRow(dataKey);
        if (!row.hasSignal) return;
        entries.push({ labelId, dataKey, row, pos: positions[labelId] });
      });
      return packLabelLayouts(entries).map((e) => ({
        labelId: e.labelId,
        dataKey: e.dataKey,
        y: e.y,
        side: e.side,
      }));
    });
  }

  function pickDefaultMuscleForTest(view, mode, recovery, growth) {
    return withTestState(mode, recovery, growth, () => {
      currentView = view;
      selectedMuscle = null;
      return pickDefaultMuscle(view);
    });
  }

  function ensureSelectionForTest(view, mode, recovery, growth, current) {
    return withTestState(mode, recovery, growth, () => {
      currentView = view;
      selectedMuscle = current;
      ensureSelectionForView(view);
      return selectedMuscle;
    });
  }

  function buildSvgForTest(view, mode, recovery, growth) {
    return withTestState(mode, recovery, growth, () => {
      currentView = view;
      currentMode = mode;
      ensureSelectionForView(view);
      return buildSvg(view);
    });
  }

  return {
    afterHomeRender,
    open,
    close,
    ensureOpenButton,
    openMuscleExercises,
    applyListSelection,
    getSortedListForTest,
    buildTipForTest,
    formatValueColorForTest,
    getFillForTest,
    formatValueLabel,
    auditRegionMapping,
    getBackRegionMusclesForTest,
    countBackSplitsForTest,
    packLabelsForTest,
    pickDefaultMuscleForTest,
    ensureSelectionForTest,
    buildSvgForTest,
    resolveDataKey,
    VIEW_MUSCLES,
    LABEL_DATA_KEY,
    DETAIL_LABEL_POSITIONS,
    DETAIL_FRONT_REGIONS,
    DETAIL_BACK_REGIONS,
    STRONG_GROWTH_PCT,
    GROWTH_TEAL,
    GROWTH_LIME,
    LOSS_VIOLET,
    LOSS_INDIGO,
    STRONG_LOSS_PCT,
    MODE_TITLES,
    OVERLAY_ID,
    BTN_WRAP_ID,
    HISTORY_FLAG,
  };
})();

if (typeof window !== 'undefined') {
  window.HomeBodyMapDetail = HomeBodyMapDetail;
}
