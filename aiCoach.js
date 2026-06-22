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

  const SYSTEM_PROMPT = `당신은 RECOVR 앱의 AI 운동 코치입니다.
사용자의 운동 기록·회복도·패턴 분석 데이터를 바탕으로 맞춤 조언을 제공합니다.

역할:
- 운동 조언, 추천 운동, 주간/일일 운동 계획 수립
- 푸시/풀, 상체/하체 밸런스, 회복 상태 고려
- 구체적 운동명·세트·반복·무게 가이드 (가능하면 사용자 기록 기반)

규칙:
- 한국어로 답변
- 간결하고 실행 가능한 조언 (모바일 화면에 맞게)
- 의학적 진단·치료 조언 금지. 통증·부상 시 전문의 상담 권고
- 데이터에 없는 내용은 추측하지 말고 일반 원칙으로 안내
- 마크다운 대신 짧은 문단과 불릿(·) 사용`;

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
    const sets = (ex.sets || []).filter(s => s.done);
    if (sets.length === 0) return ex.name;
    const top = sets.reduce((best, s) => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps) || 0;
      return (w * r) > (best.w * best.r) ? { w, r } : best;
    }, { w: 0, r: 0 });
    return `${ex.name} ${sets.length}세트 (최고 ${top.w}kg×${top.r})`;
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

    return `[사용자 운동 데이터 요약]
전체 회복도: ${overallPct}%
회복 속도 설정: ${settings.baseRecoveryHours || 48}h 기준
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

  async function callGemini(userMessage) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API_KEY_MISSING');

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: buildGeminiContents(userMessage),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
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

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('EMPTY_RESPONSE');
    return text.trim();
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
          <div class="ai-chat-welcome-title">AI 코치에게 물어보세요</div>
          <div class="ai-chat-welcome-desc">운동 기록·회복도를 바탕으로 맞춤 조언을 드려요.</div>
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
    const statusText = hasKey
      ? '운동 조언·추천·계획을 AI와 상담해보세요'
      : '설정에서 Gemini API 키를 입력하면 이용 가능해요';

    container.innerHTML = `
      <div class="ai-coach-card">
        <div class="ai-coach-top">
          <div class="ai-coach-icon">🤖</div>
          <div class="ai-coach-info">
            <div class="ai-coach-title">AI 코치 상담</div>
            <div class="ai-coach-desc">${statusText}</div>
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
