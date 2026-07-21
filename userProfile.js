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

  const CONDITION_OPTIONS = {
    none:          { label: '특별한 주의 없음', icon: '✅' },
    cervical_disc: { label: '목디스크·목 통증 주의', icon: '🧣' },
    lumbar_disc:   { label: '허리디스크·허리 통증 주의', icon: '🧘' },
    rehab_general: { label: '재활·회복 운동 필요', icon: '🩹' },
    fat_loss:      { label: '체중감량·저충격 운동 선호', icon: '🔥' },
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

  // 필수는 아니지만 몸 상태·생활습관 파악에 쓰는 선택 정보
  const JOB_ACTIVITY_OPTIONS = {
    sedentary: { label: '앉아서 하는 일 위주' },
    standing:  { label: '서 있거나 가벼운 활동' },
    physical:  { label: '육체 노동·많이 움직임' },
  };

  const STRESS_OPTIONS = {
    low:    { label: '낮음' },
    medium: { label: '보통' },
    high:   { label: '높음' },
  };

  const SLEEP_OPTIONS = {
    under5: { label: '5시간 미만', hours: 4.5 },
    '5to6': { label: '5~6시간', hours: 5.5 },
    '6to7': { label: '6~7시간', hours: 6.5 },
    '7to8': { label: '7~8시간', hours: 7.5 },
    '8plus': { label: '8시간 이상', hours: 8.5 },
  };

  const DEFAULT_PROFILE = {
    gender: '',
    birthYear: null,
    heightCm: null,
    weightKg: null,
    goal: '',
    condition: 'none',
    experience: '',
    daysPerWeek: null,
    injuryNotes: '',
    sleepHours: '',
    jobActivity: '',
    waistCm: null,
    stressLevel: '',
  };

  const MIN_AGE = 10;
  const MAX_AGE = 100;

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

  function clampInt(value, min, max) {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  function getCurrentYear() {
    return new Date().getFullYear();
  }

  function getBirthYearBounds(nowYear = getCurrentYear()) {
    return {
      min: nowYear - MAX_AGE,
      max: nowYear - MIN_AGE,
    };
  }

  /** 출생년 → 연나이(현재연도 − 출생년). 월일은 없어 만나이가 아닌 연나이 기준. */
  function getAge(profileOrBirthYear) {
    const birthYear = typeof profileOrBirthYear === 'object' && profileOrBirthYear !== null
      ? normalize(profileOrBirthYear).birthYear
      : clampInt(profileOrBirthYear, getBirthYearBounds().min, getBirthYearBounds().max);
    if (birthYear == null) return null;
    const age = getCurrentYear() - birthYear;
    if (age < MIN_AGE || age > MAX_AGE) return null;
    return age;
  }

  function migrateBirthYear(src) {
    const bounds = getBirthYearBounds();
    const direct = clampInt(src.birthYear, bounds.min, bounds.max);
    if (direct != null) return direct;

    // 기존 age 저장값 → 출생년 마이그레이션 (한 번만 변환되면 이후 자동 갱신)
    const legacyAge = clampInt(src.age, MIN_AGE, MAX_AGE);
    if (legacyAge == null) return null;
    return clampInt(getCurrentYear() - legacyAge, bounds.min, bounds.max);
  }

  function normalize(profile) {
    const src = profile && typeof profile === 'object' ? profile : {};
    return {
      gender: GENDER_OPTIONS[src.gender] ? src.gender : '',
      birthYear: migrateBirthYear(src),
      heightCm: clampNumber(src.heightCm, 100, 250),
      weightKg: clampNumber(src.weightKg, 30, 300),
      goal: GOAL_OPTIONS[src.goal] ? src.goal : '',
      condition: CONDITION_OPTIONS[src.condition] ? src.condition : 'none',
      experience: EXPERIENCE_OPTIONS[src.experience] ? src.experience : '',
      daysPerWeek: clampNumber(src.daysPerWeek, 1, 7),
      injuryNotes: typeof src.injuryNotes === 'string' ? src.injuryNotes.trim().slice(0, 200) : '',
      sleepHours: SLEEP_OPTIONS[src.sleepHours] ? src.sleepHours : '',
      jobActivity: JOB_ACTIVITY_OPTIONS[src.jobActivity] ? src.jobActivity : '',
      waistCm: (() => {
        const raw = src.waistCm;
        if (raw === '' || raw === null || raw === undefined) return null;
        const num = Number(raw);
        if (Number.isNaN(num) || num < 40 || num > 200) return null;
        return num;
      })(),
      stressLevel: STRESS_OPTIONS[src.stressLevel] ? src.stressLevel : '',
    };
  }

  function isComplete(profile) {
    const p = normalize(profile);
    return !!(p.gender && p.birthYear && p.heightCm && p.weightKg && p.goal && p.experience);
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
    const ageFactor = getAgeRecoveryFactor(getAge(p));
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
    const age = getAge(p);
    if (!age) return 48;

    let hours = 48;
    if (age >= 60) hours = 60;
    else if (age >= 50) hours = 56;
    else if (age >= 40) hours = 52;
    else if (age < 25) hours = 44;

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

  function getConditionLabel(condition) {
    return CONDITION_OPTIONS[condition]?.label || '';
  }

  function getExperienceLabel(experience) {
    return EXPERIENCE_OPTIONS[experience]?.label || '';
  }

  function getGenderLabel(gender) {
    return GENDER_OPTIONS[gender]?.label || '';
  }

  function getSleepLabel(sleepHours) {
    return SLEEP_OPTIONS[sleepHours]?.label || '';
  }

  function getJobActivityLabel(jobActivity) {
    return JOB_ACTIVITY_OPTIONS[jobActivity]?.label || '';
  }

  function getStressLabel(stressLevel) {
    return STRESS_OPTIONS[stressLevel]?.label || '';
  }

  function getBmiCategory(bmi) {
    if (bmi == null || Number.isNaN(bmi)) return null;
    if (bmi < 18.5) return { key: 'underweight', label: '저체중' };
    if (bmi < 23) return { key: 'normal', label: '정상' };
    if (bmi < 25) return { key: 'overweight', label: '과체중 주의' };
    if (bmi < 30) return { key: 'obese1', label: '비만 1단계' };
    return { key: 'obese2', label: '비만 2단계+' };
  }

  /** 아시아 성인 기준 허리둘레 위험 (대략) */
  function getWaistRisk(waistCm, gender) {
    if (waistCm == null) return null;
    const limit = gender === 'female' ? 85 : 90;
    if (waistCm >= limit) return { key: 'high', label: '복부 위험 구간' };
    if (waistCm >= limit - 5) return { key: 'warn', label: '복부 경계' };
    return { key: 'ok', label: '허리 양호' };
  }

  function formatForAI(profile) {
    const p = normalize(profile);
    if (!isComplete(p)) return '[프로필] 미입력 — 설정에서 신체 정보를 입력하면 맞춤 조언이 가능합니다.';

    const bmi = calcBmi(p.heightCm, p.weightKg);
    const age = getAge(p);
    const bmiCat = getBmiCategory(bmi);
    const lines = [
      `성별: ${getGenderLabel(p.gender)}`,
      `출생년: ${p.birthYear} (${age}세)`,
      `키/몸무게: ${p.heightCm}cm / ${p.weightKg}kg`,
      `BMI: ${bmi != null ? bmi : '—'}${bmiCat ? ` (${bmiCat.label})` : ''}`,
      `목표: ${getGoalLabel(p.goal)}`,
      `현재 상태: ${getConditionLabel(p.condition) || '특별한 주의 없음'}`,
      `경력: ${getExperienceLabel(p.experience)}`,
    ];
    if (p.daysPerWeek) lines.push(`주당 운동 가능: ${p.daysPerWeek}일`);
    if (p.sleepHours) lines.push(`평균 수면: ${getSleepLabel(p.sleepHours)}`);
    if (p.jobActivity) lines.push(`일상 활동: ${getJobActivityLabel(p.jobActivity)}`);
    if (p.waistCm != null) {
      const waistRisk = getWaistRisk(p.waistCm, p.gender);
      lines.push(`허리둘레: ${p.waistCm}cm${waistRisk ? ` (${waistRisk.label})` : ''}`);
    }
    if (p.stressLevel) lines.push(`스트레스: ${getStressLabel(p.stressLevel)}`);
    if (p.injuryNotes) lines.push(`주의 부위/메모: ${p.injuryNotes}`);
    return lines.join('\n');
  }

  function getHomeSummary(profile, settings) {
    const p = normalize(profile);
    const parts = [];
    const age = getAge(p);
    if (age != null) parts.push(`${age}세`);

    const bmi = calcBmi(p.heightCm, p.weightKg);
    if (bmi != null) {
      const cat = getBmiCategory(bmi);
      parts.push(cat ? `BMI ${bmi} (${cat.label})` : `BMI ${bmi}`);
    }

    if (p.goal) parts.push(getGoalLabel(p.goal));
    if (p.condition && p.condition !== 'none') parts.push(getConditionLabel(p.condition));

    if (isComplete(p)) {
      const profileFactor = getProfileRecoveryFactor(p);
      const factorPct = Math.round((profileFactor - 1) * 100);
      if (factorPct === 0) parts.push('평균 회복 속도');
      else if (factorPct > 0) parts.push(`회복 ${factorPct}% 여유 필요`);
      else parts.push(`회복 ${Math.abs(factorPct)}% 빠른 편`);
    }

    return parts.join(' · ');
  }

  function readFromForm() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };

    const birthYear = getVal('profileBirthYear');
    const heightCm = getVal('profileHeight');
    const weightKg = getVal('profileWeight');
    const daysPerWeek = getVal('profileDaysPerWeek');

    return normalize({
      gender: getVal('profileGender'),
      birthYear: birthYear === '' ? null : birthYear,
      heightCm: heightCm === '' ? null : heightCm,
      weightKg: weightKg === '' ? null : weightKg,
      goal: getVal('profileGoal'),
      condition: getVal('profileCondition') || 'none',
      experience: getVal('profileExperience'),
      daysPerWeek: daysPerWeek === '' ? null : daysPerWeek,
      injuryNotes: getVal('profileInjuryNotes'),
      sleepHours: getVal('profileSleepHours'),
      jobActivity: getVal('profileJobActivity'),
      waistCm: (() => {
        const v = getVal('profileWaist');
        return v === '' ? null : v;
      })(),
      stressLevel: getVal('profileStressLevel'),
    });
  }

  function fillForm(settings) {
    const p = normalize(settings?.profile);
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value == null ? '' : String(value);
    };

    const bounds = getBirthYearBounds();
    const birthYearInput = document.getElementById('profileBirthYear');
    if (birthYearInput) {
      birthYearInput.min = String(bounds.min);
      birthYearInput.max = String(bounds.max);
    }

    setVal('profileGender', p.gender);
    setVal('profileBirthYear', p.birthYear);
    setVal('profileHeight', p.heightCm);
    setVal('profileWeight', p.weightKg);
    setVal('profileGoal', p.goal);
    setVal('profileCondition', p.condition);
    setVal('profileExperience', p.experience);
    setVal('profileDaysPerWeek', p.daysPerWeek);
    setVal('profileInjuryNotes', p.injuryNotes);
    setVal('profileSleepHours', p.sleepHours);
    setVal('profileJobActivity', p.jobActivity);
    setVal('profileWaist', p.waistCm);
    setVal('profileStressLevel', p.stressLevel);

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
    if (!p.birthYear && !p.heightCm && !p.weightKg) {
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
    CONDITION_OPTIONS,
    EXPERIENCE_OPTIONS,
    GENDER_OPTIONS,
    JOB_ACTIVITY_OPTIONS,
    STRESS_OPTIONS,
    SLEEP_OPTIONS,
    DEFAULT_PROFILE,
    normalize,
    isComplete,
    calcBmi,
    getAge,
    getBirthYearBounds,
    getBmiCategory,
    getWaistRisk,
    getSleepLabel,
    getJobActivityLabel,
    getStressLabel,
    getProfileRecoveryFactor,
    getRecoveryScale,
    getSuggestedBaseRecoveryHours,
    getConditionLabel,
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
