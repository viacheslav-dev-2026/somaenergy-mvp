(function () {
  "use strict";

  const STORAGE_KEY = "soma_sessions";
  const SKIP_INTRO_KEY = "soma_skip_intro";

  const PRACTICE_HOWTO = {
    reset30: [
      "Что делать: сядь удобно, стопы на полу. Следуй за кругом: сделай глубокий вдох носом (4 с), короткий довдох до верха легких (2 с) и долгий мягкий выдох ртом (8 с).",
      "Сигналы: высокий тон — начало вдоха; низкий тон — начало длинного выдоха; вибрация в паузе — сигнал разомкнуть челюсть и расслабить кисти рук; двойной тон в конце — завершение (2 полных цикла)."
    ],
    pause90: [
      "Что делать: сразу после нажатия на кнопку оценки отведи взгляд от экрана в окно (вдаль) или прикрой глаза. Не нужно смотреть на экран во время таймера.",
      "Сигнал 45 секунд (звук мягкого колокольчика): услышав колокольчик в середине практики, не фокусируй взгляд на экране. Сделай спокойный выдох и безоценочно проверь тело на зажимы (челюсть, плечи, кисти, поясница, стопы). Если ничего не заметил — ничего не выдумывай и спокойно дыши дальше.",
      "Сигнал 90 секунд (двойной тон): практика окончена, возвращайся к экрану."
    ],
    draft15: [
      "Что делать: впиши минимальный шаг, который реально набросать за 15 минут без перфекционизма. При желании включи \"Фоновый шум\" (мягкий коричневый шум для отсечения офисных звуков).",
      "Сигналы: таймер идет без отвлекающих звуков. В конце на 15:00 прозвучит мягкий сигнал \"Стоп\" — сохрани черновик как есть.",
      "iphone"
    ]
  };

  const PRACTICES = {
    reset30: {
      id: "reset30",
      title: "Быстрый Reset",
      subtitle: "30 секунд. Дыхание, снятие мышечного панциря и опора.",
      durationSec: 30,
      phases: [
        { start: 0, end: 4, text: "Вдох через нос", anim: "expand", sound: "soft" },
        { start: 4, end: 6, text: "Короткий довдох", anim: "expand-more", sound: "none" },
        { start: 6, end: 14, text: "Долгий мягкий выдох ртом", anim: "shrink", sound: "low" },
        { start: 14, end: 16, text: "Разомкни челюсть. Расслабь кисти рук", anim: "static", vibrate: true },
        { start: 16, end: 20, text: "Вдох через нос", anim: "expand", sound: "soft" },
        { start: 20, end: 22, text: "Короткий довдох", anim: "expand-more", sound: "none" },
        { start: 22, end: 30, text: "Выдох. Опусти плечи. Отпусти поясницу и почувствуй стопы", anim: "shrink", sound: "final" }
      ]
    },
    pause90: {
      id: "pause90",
      title: "Пауза и расфокус",
      subtitle: "90 секунд. Панорамный взгляд в пространство и присутствие.",
      durationSec: 90,
      phases: [
        { start: 0, end: 15, text: "Отведи взгляд от экрана. Посмотри в окно, в небо или на дальнюю точку.", sound: "start" },
        { start: 15, end: 30, text: "Смотри мягко, расфокусированно. Не всматривайся в детали.", anim: "static" },
        { start: 30, end: 45, text: "Оставь взгляд мягким или прикрой глаза.", sound: "soft", vibrate: true, anim: "static" },
        { start: 45, end: 60, text: "Пройдись вниманием по телу: челюсть, шея, плечи, кисти рук, поясница, икры ног.", anim: "static" },
        { start: 60, end: 75, text: "Просто замечай любое ощущение напряжения или шума как оно есть.", sound: "soft", vibrate: true, anim: "static" },
        { start: 75, end: 90, text: "Не борись с ощущением и не оценивай его. Спокойно дыши рядом с ним.", anim: "static" },
        { start: 90, end: 90, text: "Возвращайся. Следующий шаг — маленький.", sound: "final", vibrate: true, anim: "static" }
      ]
    },
    draft15: {
      id: "draft15",
      title: "Вход в вайб",
      subtitle: "15 минут. Спокойный рабочий черновик без перфекционизма.",
      durationSec: 900,
      phases: []
    }
  };

  const PRACTICE_LABELS = {
    reset30: "Быстрый Reset",
    pause90: "Пауза и расфокус",
    draft15: "Вход в вайб"
  };

  let audioCtx = null;
  let brownNoiseNode = null;
  let brownGain = null;

  let currentPracticeId = null;
  let stressBefore = null;
  let microTaskText = "";
  let runStartTs = 0;
  let pausedAccum = 0;
  let pauseStarted = 0;
  let isPaused = false;
  let tickTimer = null;
  let lastPhaseKey = "";
  let playedSounds = new Set();
  let stressAfter = null;
  let completedNaturally = false;
  let wakeLock = null;

  const el = {
    datetime: document.getElementById("datetime"),
    viewIntro: document.getElementById("view-intro"),
    viewNow: document.getElementById("view-now"),
    viewDynamics: document.getElementById("view-dynamics"),
    bottomNav: document.querySelector(".bottom-nav"),
    btnGuide: document.getElementById("btn-guide"),
    skipIntro: document.getElementById("skip-intro"),
    btnIntroContinue: document.getElementById("btn-intro-continue"),
    practiceHowto: document.getElementById("practice-howto"),
    practiceHowtoBody: document.getElementById("practice-howto-body"),
    summaryWeek: document.getElementById("summary-week"),
    summaryAvg: document.getElementById("summary-avg"),
    sessionList: document.getElementById("session-list"),
    emptyState: document.getElementById("empty-state"),
    overlay: document.getElementById("overlay"),
    phasePre: document.getElementById("phase-pre"),
    phaseRun: document.getElementById("phase-run"),
    phaseComplete: document.getElementById("phase-complete"),
    preTitle: document.getElementById("pre-title"),
    preSub: document.getElementById("pre-sub"),
    draftTaskBlock: document.getElementById("draft-task-block"),
    microTask: document.getElementById("micro-task"),
    stressBeforeBtns: document.querySelectorAll("#stress-before-row .stress-btn"),
    startWithoutRating: document.getElementById("start-without-rating"),
    runTitle: document.getElementById("run-title"),
    timerDisplay: document.getElementById("timer-display"),
    breathCircle: document.getElementById("breath-circle"),
    practiceHint: document.getElementById("practice-hint"),
    draftMidline: document.getElementById("draft-midline"),
    draftControls: document.getElementById("draft-controls"),
    brownNoiseToggle: document.getElementById("brown-noise-toggle"),
    btnPause: document.getElementById("btn-pause"),
    btnStopEarly: document.getElementById("btn-stop-early"),
    overlayStopRun: document.getElementById("overlay-stop-run"),
    overlayStopTop: document.getElementById("overlay-stop-top"),
    completeTitle: document.getElementById("complete-title"),
    stressAfterBtns: document.querySelectorAll("#stress-after-row .stress-btn"),
    sessionNote: document.getElementById("session-note"),
    btnSaveSession: document.getElementById("btn-save-session"),
    modalAbout: document.getElementById("modal-about"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalClose: document.getElementById("modal-close"),
    btnAbout: document.getElementById("btn-about"),
    aboutTabs: document.querySelectorAll(".modal-tab"),
    aboutPanels: {
      method: document.getElementById("panel-method"),
      map: document.getElementById("panel-map"),
      research: document.getElementById("panel-research")
    }
  };

  function initAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, peakGain) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peakGain, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function playSoundKind(kind) {
    if (kind === "none") return;
    if (kind === "soft" || kind === "start") playTone(432, 0.35, 0.08);
    else if (kind === "low") playTone(288, 0.45, 0.07);
    else if (kind === "final") playTone(432, 0.5, 0.09);
  }

  function vibrateShort() {
    if (navigator.vibrate) navigator.vibrate(120);
  }

  function vibrateFinal() {
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
  }

  function ensureBrownNoise() {
    if (!audioCtx || brownNoiseNode) return;
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    brownNoiseNode = audioCtx.createBufferSource();
    brownNoiseNode.buffer = buffer;
    brownNoiseNode.loop = true;
    brownGain = audioCtx.createGain();
    brownGain.gain.value = 0;
    brownNoiseNode.connect(brownGain);
    brownGain.connect(audioCtx.destination);
    brownNoiseNode.start();
  }

  function setBrownNoise(on) {
    ensureBrownNoise();
    if (brownGain) {
      brownGain.gain.setTargetAtTime(on ? 0.035 : 0, audioCtx.currentTime, 0.15);
    }
  }

  function formatClock(d) {
    const pad = (n) => String(n).padStart(2, "0");
    const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function updateDatetime() {
    el.datetime.textContent = formatClock(new Date());
  }

  function getSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function startOfWeek(d) {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() + diff);
    return copy.getTime();
  }

  function renderDynamics() {
    const sessions = getSessions().sort((a, b) => b.ts - a.ts);
    const now = Date.now();
    const weekStart = startOfWeek(new Date(now));
    const weekSessions = sessions.filter((s) => s.ts >= weekStart);
    el.summaryWeek.textContent = `На этой неделе: ${weekSessions.length} практик`;

    const withBoth = weekSessions.filter(
      (s) => typeof s.stressBefore === "number" && typeof s.stressAfter === "number"
    );
    if (withBoth.length) {
      const avg =
        withBoth.reduce((sum, s) => sum + (s.stressBefore - s.stressAfter), 0) / withBoth.length;
      el.summaryAvg.textContent = `Среднее снижение напряжения: ${avg.toFixed(1)}`;
    } else {
      el.summaryAvg.textContent = "Среднее снижение напряжения: —";
    }

    el.sessionList.innerHTML = "";
    if (!sessions.length) {
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;

    sessions.forEach((s) => {
      const li = document.createElement("li");
      const time = new Date(s.ts);
      const pad = (n) => String(n).padStart(2, "0");
      const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}`;
      const name = PRACTICE_LABELS[s.practice] || s.practice;
      let stressPart = "";
      if (typeof s.stressBefore === "number" && typeof s.stressAfter === "number") {
        stressPart = ` · ${s.stressBefore} → ${s.stressAfter}`;
      } else if (typeof s.stressAfter === "number") {
        stressPart = ` · → ${s.stressAfter}`;
      }
      let notePart = "";
      if (s.note) notePart = ` · «${s.note}»`;
      let draftPart = "";
      if (s.practice === "draft15" && s.microTask) {
        draftPart = ` · черновик: «${s.microTask}»`;
      }
      li.textContent = `${timeStr} · ${name}${stressPart}${notePart}${draftPart}`;
      el.sessionList.appendChild(li);
    });
  }

  function setSkipIntroCheckbox() {
    el.skipIntro.checked = localStorage.getItem(SKIP_INTRO_KEY) !== "false";
  }

  function setNavVisible(visible) {
    if (!el.bottomNav) return;
    el.bottomNav.hidden = !visible;
    document.body.classList.toggle("intro-open", !visible);
  }

  function showIntro() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.remove("nav-active");
    });
    el.viewIntro.hidden = false;
    el.viewNow.hidden = true;
    el.viewDynamics.hidden = true;
    setNavVisible(false);
    setSkipIntroCheckbox();
    window.scrollTo(0, 0);
  }

  function switchTab(tab) {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("nav-active", btn.dataset.tab === tab);
    });
    el.viewIntro.hidden = true;
    el.viewNow.hidden = tab !== "now";
    el.viewDynamics.hidden = tab !== "dynamics";
    setNavVisible(true);
    if (tab === "dynamics") renderDynamics();
  }

  function goToExercisesFromIntro() {
    localStorage.setItem(SKIP_INTRO_KEY, el.skipIntro.checked ? "true" : "false");
    switchTab("now");
  }

  function fillPracticeHowto(practiceId) {
    const lines = PRACTICE_HOWTO[practiceId] || [];
    el.practiceHowtoBody.innerHTML = "";
    lines.forEach((line) => {
      const p = document.createElement("p");
      if (line === "iphone") {
        p.className = "howto-iphone";
        p.textContent =
          "На iPhone убедитесь, что выключен боковой рычажок беззвучного режима, чтобы слышать сигналы.";
      } else {
        p.textContent = line;
      }
      el.practiceHowtoBody.appendChild(p);
    });
    el.practiceHowto.open = false;
  }

  async function requestWakeLock() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    try {
      if (wakeLock) {
        await wakeLock.release();
      }
    } catch {
      /* ignore unsupported / already released */
    }
    wakeLock = null;
  }

  function draftPreReady() {
    return el.microTask.value.trim().length >= 3;
  }

  function updateDraftPreButtons() {
    const ready = draftPreReady();
    el.stressBeforeBtns.forEach((btn) => {
      btn.disabled = !ready;
    });
    el.startWithoutRating.disabled = !ready;
  }

  function openOverlay(practiceId) {
    currentPracticeId = practiceId;
    stressBefore = null;
    microTaskText = "";
    stressAfter = null;
    completedNaturally = false;
    lastPhaseKey = "";
    playedSounds.clear();
    isPaused = false;
    pausedAccum = 0;

    const p = PRACTICES[practiceId];
    el.preTitle.textContent = p.title;
    el.preSub.textContent = p.subtitle;
    fillPracticeHowto(practiceId);
    el.microTask.value = "";
    el.draftTaskBlock.hidden = practiceId !== "draft15";
    el.stressBeforeBtns.forEach((b) => {
      b.classList.remove("selected");
      b.disabled = practiceId === "draft15";
    });
    el.startWithoutRating.disabled = practiceId === "draft15";

    el.phasePre.hidden = false;
    el.phaseRun.hidden = true;
    el.phaseComplete.hidden = true;
    el.overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeOverlayCleanup() {
    stopTick();
    releaseWakeLock();
    setBrownNoise(false);
    if (el.brownNoiseToggle) el.brownNoiseToggle.checked = false;
    el.overlay.hidden = true;
    document.body.style.overflow = "";
    currentPracticeId = null;
  }

  function formatTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function elapsedSec() {
    if (!runStartTs) return 0;
    let elapsed = Date.now() - runStartTs - pausedAccum;
    if (isPaused && pauseStarted) {
      elapsed -= Date.now() - pauseStarted;
    }
    return Math.max(0, elapsed / 1000);
  }

  function applyBreathAnim(anim) {
    el.breathCircle.className = "breath-circle";
    if (anim) el.breathCircle.classList.add(anim);
  }

  function handlePhaseEvents(practice, t) {
    if (practice.id === "draft15") {
      const remaining = practice.durationSec - t;
      if (remaining <= 450 && !playedSounds.has("midline")) {
        playedSounds.add("midline");
        el.draftMidline.hidden = false;
      }
      return;
    }

    const phases = practice.phases;
    for (let i = 0; i < phases.length; i++) {
      const ph = phases[i];
      if (t >= ph.start && t < ph.end) {
        const key = `${i}-${ph.text}`;
        if (key !== lastPhaseKey) {
          lastPhaseKey = key;
          el.practiceHint.textContent = ph.text;
          if (ph.anim) applyBreathAnim(ph.anim);
          else applyBreathAnim("static");
        }
        const soundKey = `${i}-sound`;
        if (ph.sound && !playedSounds.has(soundKey)) {
          playedSounds.add(soundKey);
          playSoundKind(ph.sound);
        }
        const vibKey = `${i}-vib`;
        if (ph.vibrate && !playedSounds.has(vibKey)) {
          playedSounds.add(vibKey);
          vibrateShort();
        }
        return;
      }
    }

    if (practice.id === "pause90" && t >= 90) {
      const key = "final-90";
      if (lastPhaseKey !== key) {
        lastPhaseKey = key;
        el.practiceHint.textContent = "Возвращайся. Следующий шаг — маленький.";
        applyBreathAnim("static");
      }
      if (!playedSounds.has("final90")) {
        playedSounds.add("final90");
        playSoundKind("final");
        vibrateFinal();
      }
    }

    if (practice.id === "reset30" && t >= 29.2) {
      const vibKey = "reset-final-vib";
      if (!playedSounds.has(vibKey)) {
        playedSounds.add(vibKey);
        vibrateFinal();
      }
    }
  }

  function showComplete() {
    stopTick();
    releaseWakeLock();
    setBrownNoise(false);
    el.phaseRun.hidden = true;
    el.phaseComplete.hidden = false;
    if (currentPracticeId === "draft15") {
      el.completeTitle.textContent = "Стоп. Черновик можно сохранить как есть.";
    } else {
      el.completeTitle.textContent = "Готово. Как сейчас?";
    }
    el.stressAfterBtns.forEach((b) => b.classList.remove("selected"));
    el.sessionNote.value = "";
    stressAfter = null;
    el.btnSaveSession.disabled = true;
  }

  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function startRun() {
    initAudio();
    const p = PRACTICES[currentPracticeId];
    microTaskText = currentPracticeId === "draft15" ? el.microTask.value.trim() : "";

    el.runTitle.textContent = p.title;
    el.phasePre.hidden = true;
    el.phaseRun.hidden = false;
    el.draftMidline.hidden = true;
    el.draftControls.hidden = currentPracticeId !== "draft15";
    el.overlayStopRun.hidden = currentPracticeId === "draft15";
    el.breathCircle.hidden = currentPracticeId === "draft15";
    el.practiceHint.textContent =
      currentPracticeId === "draft15" ? "Черновик без перфекционизма. Просто набросай." : "";

    runStartTs = Date.now();
    pausedAccum = 0;
    isPaused = false;
    lastPhaseKey = "";
    playedSounds.clear();
    el.btnPause.textContent = "Пауза";

    stopTick();
    requestWakeLock();
    tickTimer = setInterval(tick, 100);
    tick();
  }

  function tick() {
    const p = PRACTICES[currentPracticeId];
    if (!p || isPaused) return;

    const t = elapsedSec();
    const remaining = p.durationSec - t;

    handlePhaseEvents(p, t);

    if (currentPracticeId === "draft15") {
      el.timerDisplay.textContent = formatTimer(Math.max(0, Math.ceil(remaining)));
    } else {
      el.timerDisplay.textContent = formatTimer(Math.max(0, Math.ceil(remaining)));
    }

    if (remaining <= 0) {
      completedNaturally = true;
      showComplete();
    }
  }

  function beginWithStress(value) {
    initAudio();
    stressBefore = value;
    startRun();
  }

  function beginWithoutRating() {
    initAudio();
    stressBefore = null;
    startRun();
  }

  function stopPracticeEarly() {
    if (!el.phasePre.hidden || !el.phaseComplete.hidden) {
      closeOverlayCleanup();
      return;
    }
    showComplete();
  }

  function togglePause() {
    if (isPaused) {
      pausedAccum += Date.now() - pauseStarted;
      pauseStarted = 0;
      isPaused = false;
      el.btnPause.textContent = "Пауза";
      stopTick();
      tickTimer = setInterval(tick, 100);
    } else {
      isPaused = true;
      pauseStarted = Date.now();
      el.btnPause.textContent = "Продолжить";
    }
  }

  function saveSession() {
    if (stressAfter === null || !currentPracticeId) return;
    const session = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ts: Date.now(),
      practice: currentPracticeId,
      stressBefore: stressBefore,
      stressAfter: stressAfter,
      note: el.sessionNote.value.trim(),
      microTask: currentPracticeId === "draft15" ? microTaskText : "",
      completed: true
    };
    const sessions = getSessions();
    sessions.push(session);
    saveSessions(sessions);
    closeOverlayCleanup();
    switchTab("now");
  }

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openOverlay(card.dataset.practice));
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  el.stressBeforeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      beginWithStress(Number(btn.dataset.stress));
    });
  });

  el.startWithoutRating.addEventListener("click", () => {
    if (el.startWithoutRating.disabled) return;
    beginWithoutRating();
  });

  el.microTask.addEventListener("input", updateDraftPreButtons);

  el.stressAfterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      stressAfter = Number(btn.dataset.stress);
      el.stressAfterBtns.forEach((b) => b.classList.toggle("selected", b === btn));
      el.btnSaveSession.disabled = false;
    });
  });

  el.btnSaveSession.addEventListener("click", saveSession);

  [el.overlayStopRun, el.overlayStopTop, el.btnStopEarly].forEach((btn) => {
    btn.addEventListener("click", stopPracticeEarly);
  });

  el.btnPause.addEventListener("click", togglePause);

  el.brownNoiseToggle.addEventListener("change", () => {
    initAudio();
    setBrownNoise(el.brownNoiseToggle.checked);
  });

  function switchAboutTab(tabId) {
    el.aboutTabs.forEach((btn) => {
      const active = btn.dataset.aboutTab === tabId;
      btn.classList.toggle("modal-tab-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    Object.keys(el.aboutPanels).forEach((key) => {
      const panel = el.aboutPanels[key];
      if (!panel) return;
      const active = key === tabId;
      panel.hidden = !active;
      panel.classList.toggle("about-panel-active", active);
    });
  }

  function openAboutModal() {
    switchAboutTab("method");
    el.modalAbout.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeAboutModal() {
    el.modalAbout.hidden = true;
    if (el.overlay.hidden) document.body.style.overflow = "";
  }

  el.btnGuide.addEventListener("click", showIntro);
  el.btnIntroContinue.addEventListener("click", goToExercisesFromIntro);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && tickTimer && !el.phaseRun.hidden) {
      requestWakeLock();
    }
  });

  el.btnAbout.addEventListener("click", openAboutModal);
  el.modalClose.addEventListener("click", closeAboutModal);
  el.modalBackdrop.addEventListener("click", closeAboutModal);

  el.aboutTabs.forEach((btn) => {
    btn.addEventListener("click", () => switchAboutTab(btn.dataset.aboutTab));
  });

  updateDatetime();
  setInterval(updateDatetime, 30000);
  renderDynamics();
  if (localStorage.getItem(SKIP_INTRO_KEY) === "true") {
    switchTab("now");
  } else {
    showIntro();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
