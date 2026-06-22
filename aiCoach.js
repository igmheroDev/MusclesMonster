// ============================================================
// RECOVR - AI 코치 상담 모듈 (Gemini Flash, 독립 모듈)
// 운동 조언·추천·계획을 AI와 상담할 수 있습니다.
// API 키는 사용자가 설정에서 직접 입력 (BYOK, localStorage 저장)
// ============================================================

const AiCoach = (() => {
  const MODEL = 'gemini-2.5-flash';
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const CHAT_HISTORY_KEY = 'recovr_ai_chat_v1';
  const MAX_HISTORY = 16;
  const LOOKBACK_DAYS = 14;

  const QUICK_PROMPTS = [
    '오늘 뭐 운동하면 좋을까?',
    '이번 주 운동 계획 짜줘',
    '푸시/풀 밸런스 어때?',
    '회복 안 된 부위 알려줘',
  ];

  const SYSTEM_PROMPT = `당신은 헬스 트레이너 경력 20년차 전문가입니다.
모빌리티, 근비대(근육빵빵), 체형교정을 아우르는 실전 코치로서 말합니다.

[전문 분야]
· 모빌리티: 관절 가동범위, 유연성, 워밍업/쿨다운, 폼롤러·스트레칭 루틴
· 근비대: 점진적 과부하, 볼륨·빈도·강도 밸런스, 부위별 자극 최적화
· 체형교정: 라운드숄더·골반전방경사·좌우 불균형 등 자세 패턴 교정 운동

[말투·스타일]
· 자신감 있고 따뜻한 선배 트레이너 톤 ("~해보세요", "~가 핵심이에요")
· 추상적 조언 금지 → 운동명·세트·반복·무게·휴식·순서를 구체적으로
· 사용자 운동 기록·회복도·패턴 데이터를 반드시 근거로 인용 ("기록 보니 ~하셨는데")
· 데이터에 없는 수치는 지어내지 말고, 기록 기반 추정임을 명시

[답변 구조]
· 핵심 결론을 먼저 1~2문장
· 오늘/이번 주 실행 계획 (운동명·세트×반복·무게 또는 RPE)
· 모빌리티·체형교정 포인트가 있으면 짧게 추가
· 답변은 반드시 완결된 문장으로 마무리 (중간에 끊기지 않게)

[주의]
· 한국어로 답변
· 의학적 진단·치료 조언 금지. 통증·부상·디스크 의심 시 전문의 상담 권고
· 마크다운 대신 짧은 문단과 불릿(·) 사용
· 모바일에서 읽기 좋게, 한 답변은 400~800자 내외 (계획 질문은 최대 1,200자까지 가능)`;

  let chatHistory = [];
  let isSending = false;

  function getApiKey() {
    if (typeof loadSettings !== 'function') return '';
    return (loadSettings().geminiApiKey || '').trim();
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      chatHistory = raw ? JSON.parse(raw) : [];
    } catch (e) {
      chatHistory = [];
    }
  }

  function saveChatHistory() {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory.slice(-MAX_HISTORY)));
  }

  function getWorkoutsInLookback(workouts, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return workouts.filter(w => new Date(`${w.date}T12:00:00`) >= cutoff);
  }

  function summarizeExercise(ex) {
    if (!ex.name) return null;
    if (ex.mode === 'duration') return `${ex.name} (${ex.durationMin || 0}분)`;

    if (ex.setDetails && ex.setDetails.length > 0) {
      const doneSets = ex.setDetails.filter(s => s.completed);
      const target = doneSets.length > 0 ? doneSets : ex.setDetails;
      const top = target.reduce((best, s) => {
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps, 10) || 0;
        return (w * r) > (best.w * best.r) ? { w, r } : best;
      }, { w: 0, r: 0 });
      const count = doneSets.length > 0 ? doneSets.length : ex.setDetails.length;
      if (top.w > 0 || top.r > 0) {
        return `${ex.name} ${count}세트 (최고 ${top.w}kg×${top.r})`;
      }
      return `${ex.name} ${count}세트`;
    }

    const setCount = parseInt(ex.sets, 10) || 0;
    const w = parseFloat(ex.weight) || 0;
    const r = parseInt(ex.reps, 10) || 0;
    if (setCount > 0 && (w > 0 || r > 0)) {
      return `${ex.name} ${setCount}세트 (${w}kg×${r})`;
    }
    return ex.name;
  }

  function buildContext() {
    if (typeof getCompletedWorkouts !== 'function' || typeof calcMuscleRecovery !== 'function') {
      return '운동 데이터를 불러올 수 없습니다.';
    }

    const workouts = getCompletedWorkouts();
    const settings = loadSettings();
    const recovery = calcMuscleRecovery(workouts, settings);
    const recent = getWorkoutsInLookback(workouts, LOOKBACK_DAYS);

    const active = MUSCLE_ORDER.filter(m => recovery[m]?.lastDate);
    let overallPct = 100;
    if (active.length > 0) {
      overallPct = Math.round(active.reduce((s, m) => s + recovery[m].recoveryPct, 0) / active.length);
    }

    const muscleLines = active
      .sort((a, b) => recovery[a].recoveryPct - recovery[b].recoveryPct)
      .map(m => {
        const r = recovery[m];
        const label = MUSCLE_LABELS[m];
        return `  · ${label.name}: ${r.recoveryPct}% (${formatHoursElapsed(r.hoursElapsed)} 경과)`;
      });

    const sessionLines = recent.slice(-8).map(w => {
      const typeLabel = { upper: '상체', lower: '하체', full: '전신' }[w.type] || w.type;
      const fatigue = w.fatigue ? `피로도${w.fatigue}` : '';
      const exercises = (w.exercises || []).map(summarizeExercise).filter(Boolean).join(', ');
      return `  · ${w.date} [${typeLabel}${fatigue ? ' · ' + fatigue : ''}] ${exercises || '(항목 없음)'}`;
    });

    let ruleRec = '';
    if (typeof WorkoutRecommendation !== 'undefined') {
      try {
        const rec = WorkoutRecommendation.compute(workouts, settings);
        if (rec && rec.label) {
          ruleRec = `\n[규칙 기반 추천] ${rec.label}: ${rec.reason}`;
        }
      } catch (e) { /* ignore */ }
    }

    let ruleAdvice = '';
    if (typeof WorkoutAdvice !== 'undefined') {
      try {
        const advice = WorkoutAdvice.compute(workouts);
        if (advice && advice.length > 0) {
          ruleAdvice = '\n[패턴 분석 조언]\n' + advice.map(a => `  · ${a.title}: ${a.message}`).join('\n');
        }
      } catch (e) { /* ignore */ }
    }

    return `[사용자 프로필]
${typeof UserProfile !== 'undefined' ? UserProfile.formatForAI(settings.profile) : '미입력'}

[사용자 운동 데이터 요약]
전체 회복도: ${overallPct}%
회복 속도 설정: ${settings.baseRecoveryHours || 48}h 기준${typeof UserProfile !== 'undefined' && UserProfile.isComplete(settings.profile)
  ? ` · 프로필 보정 ×${UserProfile.getProfileRecoveryFactor(settings.profile).toFixed(2)}`
  : ''}
총 기록: ${workouts.length}회 · 최근 ${LOOKBACK_DAYS}일: ${recent.length}회

[부위별 회복 (낮은 순)]
${muscleLines.length > 0 ? muscleLines.join('\n') : '  · 기록 없음'}

[최근 운동 세션]
${sessionLines.length > 0 ? sessionLines.join('\n') : '  · 최근 기록 없음'}${ruleRec}${ruleAdvice}`;
  }

  function buildGeminiContents(userMessage) {
    const context = buildContext();
    const contents = [];

    chatHistory.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    });

    const contextBlock = `[현재 데이터]\n${context}\n\n[질문]\n${userMessage}`;
    contents.push({ role: 'user', parts: [{ text: contextBlock }] });

    return contents;
  }

  function extractResponseText(candidate) {
    const parts = candidate?.content?.parts || [];
    return parts.map(p => p.text || '').join('').trim();
  }

  async function requestGemini(contents) {
    const apiKey = getApiKey();
    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const res = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      if (res.status === 429) throw new Error('RATE_LIMIT');
      if (res.status === 400 && msg.includes('API key')) throw new Error('INVALID_KEY');
      throw new Error(msg);
    }

    return res.json();
  }

  async function callGemini(userMessage) {
    if (!getApiKey()) throw new Error('API_KEY_MISSING');

    let contents = buildGeminiContents(userMessage);
    let fullText = '';
    const MAX_CONTINUES = 2;

    for (let attempt = 0; attempt <= MAX_CONTINUES; attempt++) {
      const data = await requestGemini(contents);
      const candidate = data?.candidates?.[0];
      const chunk = extractResponseText(candidate);
      if (!chunk && attempt === 0) throw new Error('EMPTY_RESPONSE');

      fullText += (fullText && chunk ? '\n' : '') + chunk;
      const finishReason = candidate?.finishReason;

      if (finishReason !== 'MAX_TOKENS') break;

      contents = [
        ...contents,
        { role: 'model', parts: [{ text: chunk }] },
        { role: 'user', parts: [{ text: '방금 답변이 중간에 끊겼어요. 끊긴 부분부터 이어서 완결된 문장으로 마무리해주세요.' }] },
      ];
    }

    if (!fullText.trim()) throw new Error('EMPTY_RESPONSE');
    return fullText.trim();
  }

  function getErrorMessage(err) {
    const code = err?.message || String(err);
    if (code === 'API_KEY_MISSING') return '설정에서 Gemini API 키를 먼저 입력해주세요.';
    if (code === 'INVALID_KEY') return 'API 키가 올바르지 않아요. Google AI Studio에서 키를 확인해주세요.';
    if (code === 'RATE_LIMIT') return '요청 한도에 도달했어요. 잠시 후 다시 시도해주세요. (무료: 약 15회/분, 1,500회/일)';
    if (code === 'EMPTY_RESPONSE') return '응답을 받지 못했어요. 다시 시도해주세요.';
    return `오류: ${code}`;
  }

  function appendMessage(role, text) {
    const list = document.getElementById('aiChatMessages');
    if (!list) return;

    const div = document.createElement('div');
    div.className = `ai-msg ai-msg--${role}`;
    div.textContent = text;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  function renderChatMessages() {
    const list = document.getElementById('aiChatMessages');
    if (!list) return;
    list.innerHTML = '';

    if (chatHistory.length === 0) {
      list.innerHTML = `
        <div class="ai-chat-welcome">
          <div class="ai-chat-welcome-icon">🤖</div>
          <div class="ai-chat-welcome-title">20년차 전문 트레이너에게 물어보세요</div>
          <div class="ai-chat-welcome-desc">모빌리티·근비대·체형교정 — 내 운동 기록을 바탕으로 맞춤 코칭해드려요.</div>
        </div>`;
      return;
    }

    chatHistory.forEach(msg => appendMessage(msg.role, msg.text));
  }

  function setLoading(show) {
    const btn = document.getElementById('aiChatSendBtn');
    const input = document.getElementById('aiChatInput');
    if (btn) {
      btn.disabled = show;
      btn.textContent = show ? '...' : '전송';
    }
    if (input) input.disabled = show;
    isSending = show;
  }

  async function sendMessage(text) {
    const message = (text || '').trim();
    if (!message || isSending) return;

    if (!getApiKey()) {
      appendMessage('error', getErrorMessage({ message: 'API_KEY_MISSING' }));
      return;
    }

    appendMessage('user', message);
    setLoading(true);

    try {
      const reply = await callGemini(message);
      chatHistory.push({ role: 'user', text: message });
      chatHistory.push({ role: 'assistant', text: reply });
      saveChatHistory();
      appendMessage('assistant', reply);
    } catch (e) {
      console.warn('[RECOVR AI] 상담 실패:', e);
      appendMessage('error', getErrorMessage(e));
    } finally {
      setLoading(false);
      const input = document.getElementById('aiChatInput');
      if (input) { input.value = ''; input.focus(); }
    }
  }

  function openChat() {
    loadChatHistory();
    const overlay = document.getElementById('aiChatOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    renderChatMessages();
    document.getElementById('aiChatInput')?.focus();
  }

  function closeChat() {
    document.getElementById('aiChatOverlay')?.classList.remove('show');
  }

  function closeChatOnOverlay(e) {
    if (e.target.id === 'aiChatOverlay') closeChat();
  }

  function clearChat() {
    if (!confirm('대화 기록을 모두 삭제할까요?')) return;
    chatHistory = [];
    saveChatHistory();
    renderChatMessages();
  }

  function handleInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e.target.value);
    }
  }

  function renderHomeCard() {
    const container = document.getElementById('aiCoachCard');
    if (!container) return;

    const hasKey = !!getApiKey();

    container.innerHTML = `
      <div class="ai-coach-card">
        <div class="ai-coach-top">
          <div class="ai-coach-icon">🤖</div>
          <div class="ai-coach-info">
            <div class="ai-coach-title">AI 코치 상담</div>
            <div class="ai-coach-desc">${hasKey ? '20년차 트레이너 · 모빌리티·근비대·체형교정 전문' : '설정에서 Gemini API 키를 입력하면 이용 가능해요'}</div>
          </div>
        </div>
        <div class="ai-quick-prompts">
          ${QUICK_PROMPTS.map(p => `<button class="ai-quick-btn" data-prompt="${p.replace(/"/g, '&quot;')}">${p}</button>`).join('')}
        </div>
        <button class="ai-coach-open-btn" onclick="${hasKey ? 'AiCoach.openChat()' : "switchView('settings')"}">
          ${hasKey ? '💬 상담 시작' : '⚙️ API 키 설정하기'}
        </button>
      </div>`;

    bindQuickPrompts();
  }

  function renderSettings() {
    const input = document.getElementById('geminiApiKey');
    if (!input) return;
    const settings = typeof loadSettings === 'function' ? loadSettings() : {};
    input.value = settings.geminiApiKey || '';
  }

  function saveApiKey() {
    const input = document.getElementById('geminiApiKey');
    if (!input || typeof loadSettings !== 'function' || typeof saveSettingsToStorage !== 'function') return;

    const settings = loadSettings();
    settings.geminiApiKey = input.value.trim();
    saveSettingsToStorage(settings);

    const status = document.getElementById('geminiKeyStatus');
    if (status) {
      status.textContent = settings.geminiApiKey ? '✓ API 키 저장됨' : '키가 삭제됐어요';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }

    renderHomeCard();
  }

  function bindQuickPrompts() {
    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        openChat();
        if (prompt) sendMessage(prompt);
      });
    });
  }

  function init() {
    loadChatHistory();
  }

  return {
    init,
    renderHomeCard,
    renderSettings,
    saveApiKey,
    openChat,
    closeChat,
    closeChatOnOverlay,
    sendMessage,
    clearChat,
    handleInputKey,
  };
})();
