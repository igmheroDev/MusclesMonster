// ============================================================
// RECOVR - 사용자 프로필 모듈 (독립 모듈, 로컬 전용)
// 신체 정보·목표·경력을 기반으로 회복 보정·추천 가중치를 제공합니다.
// ============================================================

const UserProfile = (() => {
  const GOAL_OPTIONS = {
    hypertrophy: { label: '근비대', icon: '💪' },
    fat_loss:    { label: '체중 감량', icon: '🔥' },
    maintain:    { label: '유지', icon: '🔄' },
    strength:    { label: '근력', icon: '🏋️' },
    rehab:       { label: '재활·통증 관리', icon: '🩹' },
  };

  const EXPERIENCE_OPTIONS = {
    beginner:    { label: '초보 (6개월 미만)' },
    under1year:{ label: '1년 미만' },
    '1to3years': { label: '1~3년' },
    '3years+':   { label: '3년 이상' },
  };

  const GENDER_OPTIONS = {
    male:   { label: '남성' },
    female: { label: '여성' },
    other:  { label: '기타/응답 안 함' },
  };

  const DEFAULT_PROFILE = {
    gender: '',
    age: null,
    heightCm: null,
    weightKg: null,
    goal: '',
    experience: '',
    daysPerWeek: null,
    injuryNotes: '',
  };

  const AGE_RECOVERY_FACTORS = [
    { max: 24, factor: 0.95 },
    { max: 39, factor: 1.0 },
    { max: 49, factor: 1.08 },
    { max: 59, factor: 1.15 },
    { max: Infinity, factor: 1.22 },
  ];

  const EXPERIENCE_RECOVERY_FACTORS = {
    beginner: 1.12,
    under1year: 1.06,
    '1to3years': 1.0,
    '3years+': 0.94,
  };

  const BMI_RECOVERY_FACTORS = [
    { max: 18.5, factor: 1.05 },
    { max: 25, factor: 1.0 },
    { max: 30, factor: 1.06 },
    { max: Infinity, factor: 1.12 },
  ];

  function clampNumber(value, min, max) {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.min(max, Math.max(min, num));
  }

  function normalize(profile) {
    const src = profile && typeof profile === 'object' ? profile : {};
    return {
      gender: GENDER_OPTIONS[src.gender] ? src.gender : '',
      age: clampNumber(src.age, 10, 100),
      heightCm: clampNumber(src.heightCm, 100, 250),
      weightKg: clampNumber(src.weightKg, 30, 300),
      goal: GOAL_OPTIONS[src.goal] ? src.goal : '',
      experience: EXPERIENCE_OPTIONS[src.experience] ? src.experience : '',
      daysPerWeek: clampNumber(src.daysPerWeek, 1, 7),
      injuryNotes: typeof src.injuryNotes === 'string' ? src.injuryNotes.trim().slice(0, 200) : '',
    };
  }

  function isComplete(profile) {
    const p = normalize(profile);
    return !!(p.gender && p.age && p.heightCm && p.weightKg && p.goal && p.experience);
  }

  function calcBmi(heightCm, weightKg) {
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!h || !w || h <= 0) return null;
    const m = h / 100;
    return Math.round((w / (m * m)) * 10) / 10;
  }

  function getFactorFromTable(value, table) {
    if (value == null || Number.isNaN(value)) return 1.0;
    const row = table.find(item => value <= item.max);
    return row ? row.factor : 1.0;
  }

  function getAgeRecoveryFactor(age) {
    return getFactorFromTable(age, AGE_RECOVERY_FACTORS);
  }

  function getExperienceRecoveryFactor(experience) {
    return EXPERIENCE_RECOVERY_FACTORS[experience] || 1.0;
  }

  function getBmiRecoveryFactor(bmi) {
    return getFactorFromTable(bmi, BMI_RECOVERY_FACTORS);
  }

  function getProfileRecoveryFactor(profile) {
    const p = normalize(profile);
    if (!isComplete(p)) return 1.0;

    const bmi = calcBmi(p.heightCm, p.weightKg);
    const ageFactor = getAgeRecoveryFactor(p.age);
    const expFactor = getExperienceRecoveryFactor(p.experience);
    const bmiFactor = bmi != null ? getBmiRecoveryFactor(bmi) : 1.0;

    return ageFactor * expFactor * bmiFactor;
  }

  function getRecoveryScale(settings) {
    const baseHours = settings?.baseRecoveryHours || 48;
    const baseScale = baseHours / 48;
    const profileFactor = getProfileRecoveryFactor(settings?.profile);
    return baseScale * profileFactor;
  }

  function getSuggestedBaseRecoveryHours(profile) {
    const p = normalize(profile);
    if (!p.age) return 48;

    let hours = 48;
    if (p.age >= 60) hours = 60;
    else if (p.age >= 50) hours = 56;
    else if (p.age >= 40) hours = 52;
    else if (p.age < 25) hours = 44;

    if (p.experience === 'beginner') hours += 4;
    else if (p.experience === 'under1year') hours += 2;
    else if (p.experience === '3years+') hours -= 2;

    const bmi = calcBmi(p.heightCm, p.weightKg);
    if (bmi != null && bmi >= 30) hours += 4;
    else if (bmi != null && bmi >= 25) hours += 2;

    return Math.min(72, Math.max(36, hours));
  }

  function applyGoalToScores(scores, profile, weekSessionCount) {
    const next = { ...scores };
    const p = normalize(profile);
    if (!p.goal) return next;

    const boost = (keys, amount) => keys.forEach(k => { next[k] = (next[k] || 0) + amount; });
    const penalize = (keys, amount) => keys.forEach(k => { next[k] = (next[k] || 0) - amount; });

    const growthKeys = ['upper_growth', 'lower_growth'];
    const maintainKeys = ['upper_maintain', 'lower_maintain'];

    switch (p.goal) {
      case 'hypertrophy':
        boost(growthKeys, 12);
        penalize(maintainKeys, 4);
        break;
      case 'fat_loss':
        boost(maintainKeys, 10);
        penalize(growthKeys, 6);
        break;
      case 'maintain':
        boost(maintainKeys, 15);
        penalize(growthKeys, 10);
        break;
      case 'strength':
        next.lower_growth = (next.lower_growth || 0) + 10;
        next.upper_growth = (next.upper_growth || 0) + 6;
        break;
      case 'rehab':
        penalize(growthKeys, 25);
        boost(maintainKeys, 10);
        break;
      default:
        break;
    }

    if (p.experience === 'beginner') {
      penalize(growthKeys, 18);
      boost(maintainKeys, 12);
    } else if (p.experience === '3years+') {
      boost(growthKeys, 8);
    }

    if (p.daysPerWeek && weekSessionCount >= p.daysPerWeek) {
      penalize(growthKeys, 20);
      boost(maintainKeys, 8);
    }

    return next;
  }

  function getGoalLabel(goal) {
    return GOAL_OPTIONS[goal]?.label || '';
  }

  function getExperienceLabel(experience) {
    return EXPERIENCE_OPTIONS[experience]?.label || '';
  }

  function getGenderLabel(gender) {
    return GENDER_OPTIONS[gender]?.label || '';
  }

  function formatForAI(profile) {
    const p = normalize(profile);
    if (!isComplete(p)) return '[프로필] 미입력 — 설정에서 신체 정보를 입력하면 맞춤 조언이 가능합니다.';

    const bmi = calcBmi(p.heightCm, p.weightKg);
    const lines = [
      `성별: ${getGenderLabel(p.gender)}`,
      `나이: ${p.age}세`,
      `키/몸무게: ${p.heightCm}cm / ${p.weightKg}kg`,
      `BMI: ${bmi != null ? bmi : '—'}`,
      `목표: ${getGoalLabel(p.goal)}`,
      `경력: ${getExperienceLabel(p.experience)}`,
    ];
    if (p.daysPerWeek) lines.push(`주당 운동 가능: ${p.daysPerWeek}일`);
    if (p.injuryNotes) lines.push(`주의 부위/메모: ${p.injuryNotes}`);
    return lines.join('\n');
  }

  function getHomeSummary(profile, settings) {
    const p = normalize(profile);
    if (!isComplete(p)) return '';

    const bmi = calcBmi(p.heightCm, p.weightKg);
    const goalLabel = getGoalLabel(p.goal);
    const profileFactor = getProfileRecoveryFactor(p);
    const factorPct = Math.round((profileFactor - 1) * 100);
    const factorText = factorPct === 0
      ? '평균 회복 속도'
      : factorPct > 0
        ? `회복 ${factorPct}% 여유 필요`
        : `회복 ${Math.abs(factorPct)}% 빠른 편`;

    return `${p.age}세 · BMI ${bmi} · ${goalLabel} · ${factorText}`;
  }

  function readFromForm() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };

    const age = getVal('profileAge');
    const heightCm = getVal('profileHeight');
    const weightKg = getVal('profileWeight');
    const daysPerWeek = getVal('profileDaysPerWeek');

    return normalize({
      gender: getVal('profileGender'),
      age: age === '' ? null : age,
      heightCm: heightCm === '' ? null : heightCm,
      weightKg: weightKg === '' ? null : weightKg,
      goal: getVal('profileGoal'),
      experience: getVal('profileExperience'),
      daysPerWeek: daysPerWeek === '' ? null : daysPerWeek,
      injuryNotes: getVal('profileInjuryNotes'),
    });
  }

  function fillForm(settings) {
    const p = normalize(settings?.profile);
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value == null ? '' : String(value);
    };

    setVal('profileGender', p.gender);
    setVal('profileAge', p.age);
    setVal('profileHeight', p.heightCm);
    setVal('profileWeight', p.weightKg);
    setVal('profileGoal', p.goal);
    setVal('profileExperience', p.experience);
    setVal('profileDaysPerWeek', p.daysPerWeek);
    setVal('profileInjuryNotes', p.injuryNotes);

    updateHint(p, settings);
  }

  function buildSelectOptions(options, emptyLabel) {
    let html = `<option value="">${emptyLabel}</option>`;
    Object.entries(options).forEach(([value, meta]) => {
      html += `<option value="${value}">${meta.label}</option>`;
    });
    return html;
  }

  function updateHint(profile, settings) {
    const hint = document.getElementById('profileHint');
    if (!hint) return;

    const p = normalize(profile);
    if (!p.age && !p.heightCm && !p.weightKg) {
      hint.textContent = '기본 정보를 입력하면 회복도·추천이 나에게 맞게 조정됩니다.';
      return;
    }

    const parts = [];
    const bmi = calcBmi(p.heightCm, p.weightKg);
    if (bmi != null) parts.push(`BMI ${bmi}`);

    if (isComplete(p)) {
      const suggested = getSuggestedBaseRecoveryHours(p);
      const current = settings?.baseRecoveryHours || 48;
      const factor = getProfileRecoveryFactor(p);
      parts.push(`프로필 회복 보정 ×${factor.toFixed(2)}`);
      if (Math.abs(suggested - current) >= 4) {
        parts.push(`권장 회복 기준값 ${suggested}h (현재 ${current}h)`);
      }
    } else {
      parts.push('목표·경력까지 입력하면 맞춤 추천이 활성화됩니다.');
    }

    hint.textContent = parts.join(' · ');
  }

  function saveFromForm() {
    if (typeof loadSettings !== 'function' || typeof saveSettingsToStorage !== 'function') return;

    const settings = loadSettings();
    settings.profile = readFromForm();
    saveSettingsToStorage(settings);
    updateHint(settings.profile, settings);

    if (typeof renderHome === 'function') renderHome();
  }

  function mergeIntoSettings(settings) {
    const next = { ...settings };
    next.profile = normalize(next.profile);
    return next;
  }

  return {
    GOAL_OPTIONS,
    EXPERIENCE_OPTIONS,
    GENDER_OPTIONS,
    DEFAULT_PROFILE,
    normalize,
    isComplete,
    calcBmi,
    getProfileRecoveryFactor,
    getRecoveryScale,
    getSuggestedBaseRecoveryHours,
    applyGoalToScores,
    formatForAI,
    getHomeSummary,
    readFromForm,
    fillForm,
    updateHint,
    saveFromForm,
    mergeIntoSettings,
    buildSelectOptions,
  };
})();
