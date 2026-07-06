// ============================================================
// RECOVR - 운동 분석 공통 유틸 (독립 모듈)
// getWorkoutsInLookback, 근육 그룹 상수 일원화
// ============================================================

const WorkoutUtils = (() => {
  const UPPER_MUSCLES = ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'forearms'];
  const LOWER_MUSCLES = ['quads', 'hamstrings', 'adductors', 'calves'];

  function getWorkoutsInLookback(workouts, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return (workouts || []).filter((w) => new Date(`${w.date}T12:00:00`) >= cutoff);
  }

  return {
    UPPER_MUSCLES,
    LOWER_MUSCLES,
    getWorkoutsInLookback,
  };
})();
