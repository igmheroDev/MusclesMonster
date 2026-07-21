// ============================================================
// RECOVR - 홈 상태 서머리 (독립 모듈)
// 프로필·회복·추천·조언을 모아 "지금 상태 / 추천 운동 / 생활습관"을 표시합니다.
// ============================================================

const HomeStatusSummary = (() => {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function averageRecoveryPct(recovery, muscleOrder) {
    if (!recovery || typeof recovery !== 'object') return null;
    const keys = Array.isArray(muscleOrder) && muscleOrder.length
      ? muscleOrder
      : Object.keys(recovery);
    const active = keys.filter((m) => recovery[m] && recovery[m].lastDate != null);
    if (!active.length) return null;
    const sum = active.reduce((acc, m) => acc + (recovery[m].recoveryPct || 0), 0);
    return Math.round(sum / active.length);
  }

  function recoveryBand(pct) {
    if (pct == null) return { label: '기록 대기', tip: '운동을 기록하면 회복 상태를 분석해요.' };
    if (pct < 40) return { label: '회복 필요', tip: '강도가 높았어요. 오늘은 휴식·가벼운 움직임이 좋아요.' };
    if (pct < 70) return { label: '회복 중', tip: '무리한 성장 운동보다 유지·모빌리티가 안전해요.' };
    if (pct < 95) return { label: '거의 회복', tip: '곧 본운동 가능. 워밍업을 충분히 하세요.' };
    return { label: '회복 완료', tip: '컨디션이 좋아요. 목표에 맞는 본운동을 진행해도 됩니다.' };
  }

  function buildLifestyleTips(profile, adviceItems) {
    const tips = [];
    const p = typeof UserProfile !== 'undefined' ? UserProfile.normalize(profile) : (profile || {});

    if (p.sleepHours === 'under5' || p.sleepHours === '5to6') {
      tips.push('수면이 짧아요. 회복·근육 성장에 7시간 전후를 목표로 해보세요.');
    }
    if (p.stressLevel === 'high') {
      tips.push('스트레스가 높을 땐 고강도보다 걷기·스트레칭·호흡 운동이 도움이 됩니다.');
    }
    if (p.jobActivity === 'sedentary') {
      tips.push('앉아 있는 시간이 길다면 매시간 가벼운 스트레칭·짧은 걷기를 넣어보세요.');
    }
    if (p.jobActivity === 'physical') {
      tips.push('일상 활동량이 많아요. 운동 볼륨을 무리하게 올리지 말고 회복 여유를 두세요.');
    }

    if (typeof UserProfile !== 'undefined') {
      const bmi = UserProfile.calcBmi(p.heightCm, p.weightKg);
      const waistRisk = UserProfile.getWaistRisk(p.waistCm, p.gender);
      if (waistRisk && waistRisk.key === 'high') {
        tips.push('허리둘레가 위험 구간에 있어요. 유산소·식습관과 코어 안정성을 함께 챙기세요.');
      } else if (bmi != null && bmi >= 25 && p.goal !== 'hypertrophy') {
        tips.push('BMI가 다소 높아요. 주 150분 유산소와 단백질 섭취를 의식해보세요.');
      } else if (bmi != null && bmi < 18.5) {
        tips.push('체중이 낮은 편이에요. 근력 운동과 충분한 식사로 기초 체력을 쌓아보세요.');
      }
    }

    if (Array.isArray(adviceItems) && adviceItems.length) {
      const first = adviceItems[0];
      if (first?.message) tips.push(first.message);
    }

    if (!tips.length) {
      tips.push('물·수면·가벼운 산책을 꾸준히 유지하면 회복과 컨디션에 도움이 됩니다.');
    }

    // 중복 문장 제거, 최대 3개
    const unique = [];
    tips.forEach((t) => {
      if (t && !unique.includes(t)) unique.push(t);
    });
    return unique.slice(0, 3);
  }

  function buildStatusLines(profile, recoveryPct, overallDesc) {
    const lines = [];
    const p = typeof UserProfile !== 'undefined' ? UserProfile.normalize(profile) : (profile || {});
    const band = recoveryBand(recoveryPct);

    if (typeof UserProfile !== 'undefined') {
      const bmi = UserProfile.calcBmi(p.heightCm, p.weightKg);
      const cat = UserProfile.getBmiCategory(bmi);
      if (bmi != null) {
        lines.push(cat ? `BMI ${bmi} · ${cat.label}` : `BMI ${bmi}`);
      }
      const waistRisk = UserProfile.getWaistRisk(p.waistCm, p.gender);
      if (p.waistCm != null) {
        lines.push(`허리 ${p.waistCm}cm${waistRisk ? ` · ${waistRisk.label}` : ''}`);
      }
      if (p.condition && p.condition !== 'none') {
        lines.push(UserProfile.getConditionLabel(p.condition));
      }
      if (p.goal) lines.push(`목표 ${UserProfile.GOAL_OPTIONS[p.goal]?.label || p.goal}`);
      if (p.sleepHours) lines.push(`수면 ${UserProfile.getSleepLabel(p.sleepHours)}`);
      if (p.stressLevel) lines.push(`스트레스 ${UserProfile.getStressLabel(p.stressLevel)}`);
    }

    const statusTitle = recoveryPct != null
      ? `${band.label} · 회복 ${recoveryPct}%`
      : band.label;

    return {
      title: statusTitle,
      detail: lines.length ? lines.join(' · ') : (overallDesc || band.tip),
      tip: band.tip,
    };
  }

  function buildWorkoutRecLine(settings, workouts) {
    if (typeof WorkoutRecommendation === 'undefined' || typeof WorkoutRecommendation.compute !== 'function') {
      return {
        title: '추천 준비 중',
        detail: '기록이 쌓이면 맞춤 운동 유형을 알려드려요.',
      };
    }

    try {
      const rec = WorkoutRecommendation.compute(workouts || [], settings || {});
      if (!rec) {
        return {
          title: '추천 준비 중',
          detail: '운동을 몇 번 더 기록하면 오늘의 추천이 열려요.',
        };
      }
      const preview = (rec.exercises || []).slice(0, 3).map((ex) => ex.name).join(' · ');
      return {
        title: `${rec.icon || '🧭'} ${rec.label || '오늘의 추천'}`,
        detail: [rec.reason, preview].filter(Boolean).join(' '),
      };
    } catch (e) {
      console.warn('[HomeStatusSummary] 추천 요약 실패:', e);
      return {
        title: '추천 준비 중',
        detail: '추천을 불러오지 못했어요. 아래에서 자세히 확인해 주세요.',
      };
    }
  }

  function build(ctx) {
    const settings = ctx?.settings || {};
    const profile = settings.profile || {};
    const recoveryPct = ctx?.recoveryPct != null
      ? ctx.recoveryPct
      : averageRecoveryPct(ctx?.recovery, ctx?.muscleOrder);
    const adviceItems = (typeof WorkoutAdvice !== 'undefined' && typeof WorkoutAdvice.compute === 'function')
      ? (WorkoutAdvice.compute(ctx?.workouts || []) || [])
      : [];

    const status = buildStatusLines(profile, recoveryPct, ctx?.overallDesc);
    const workout = buildWorkoutRecLine(settings, ctx?.workouts);
    const lifestyle = buildLifestyleTips(profile, adviceItems);

    const hasBody = typeof UserProfile !== 'undefined'
      && (UserProfile.calcBmi(profile.heightCm, profile.weightKg) != null
        || (profile.condition && profile.condition !== 'none')
        || profile.goal
        || profile.sleepHours
        || profile.waistCm);

    return {
      status,
      workout,
      lifestyle,
      emptyHint: hasBody
        ? null
        : '설정에서 키·몸무게·상태를 입력하면 맞춤 상태 요약이 채워져요.',
    };
  }

  function renderSection(label, title, detail) {
    return `
      <div class="hss-section">
        <div class="hss-label">${escapeHtml(label)}</div>
        <div class="hss-title">${escapeHtml(title)}</div>
        ${detail ? `<div class="hss-detail">${escapeHtml(detail)}</div>` : ''}
      </div>`;
  }

  function render(ctx) {
    const container = document.getElementById('homeStatusSummary');
    if (!container) return null;

    const data = build(ctx);
    const lifestyleText = data.lifestyle.join(' ');

    container.innerHTML = `
      <div class="hss-card">
        <div class="hss-header">
          <span class="hss-header-icon">📋</span>
          <div>
            <div class="hss-header-title">내 상태 요약</div>
            <div class="hss-header-sub">프로필 · 회복 · 추천을 한눈에</div>
          </div>
        </div>
        ${data.emptyHint ? `<div class="hss-empty">${escapeHtml(data.emptyHint)}</div>` : ''}
        ${renderSection('지금 상태', data.status.title, data.status.detail || data.status.tip)}
        ${renderSection('추천 운동', data.workout.title, data.workout.detail)}
        ${renderSection('생활습관', '오늘 챙기면 좋은 것', lifestyleText)}
      </div>`;

    return data;
  }

  return {
    build,
    render,
    averageRecoveryPct,
    recoveryBand,
  };
})();
