// ─── Settings ────────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem("study-pet-settings");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSettings() {
  localStorage.setItem("study-pet-settings", JSON.stringify(settings));
}

const settings = Object.assign(
  { focus: 25, shortBreak: 5, longBreak: 15, checkinInterval: 8, beepVolume: 60 },
  loadSettings()
);

// ─── Sequence ────────────────────────────────────────────────────────────────

const typeLabels = { pomodoro: "专注", shortBreak: "短休", longBreak: "长休" };

function makeStandardSequence() {
  return ["pomodoro", "pomodoro", "pomodoro", "pomodoro", "longBreak"];
}

function loadSequence() {
  try {
    const raw = localStorage.getItem("study-pet-sequence");
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr;
  } catch {
    return null;
  }
}

function saveSequence() {
  localStorage.setItem("study-pet-sequence", JSON.stringify(sequence));
}

let sequence = loadSequence() || makeStandardSequence();
let currentSeqIndex = 0;

function getDuration(type) {
  if (type === "pomodoro") return settings.focus * 60;
  if (type === "shortBreak") return settings.shortBreak * 60;
  return settings.longBreak * 60;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

function loadStats() {
  try {
    const raw = localStorage.getItem("study-pet-stats");
    const today = getTodayStr();
    if (!raw) return { focusCount: 0, slackCount: 0, dateStr: today };
    const parsed = JSON.parse(raw);
    if (parsed.dateStr !== today) return { focusCount: 0, slackCount: 0, dateStr: today };
    return {
      focusCount: Number(parsed.focusCount) || 0,
      slackCount: Number(parsed.slackCount) || 0,
      dateStr: today,
    };
  } catch {
    return { focusCount: 0, slackCount: 0, dateStr: getTodayStr() };
  }
}

function saveStats() {
  localStorage.setItem("study-pet-stats", JSON.stringify(state.stats));
}

// ─── Focus Session Log ────────────────────────────────────────────────────────

function loadFocusSessions() {
  try {
    const raw = localStorage.getItem("study-pet-sessions");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveFocusSession(durationMins) {
  const endTs = Date.now();
  const startTs = endTs - durationMins * 60000;
  const d = new Date(startTs);
  const ds =
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0");
  const sessions = loadFocusSessions();
  sessions.push({ dateStr: ds, hour: d.getHours(), duration: durationMins });
  const cutoff = new Date(endTs - 365 * 864e5);
  const cutoffStr =
    cutoff.getFullYear() +
    "-" + String(cutoff.getMonth() + 1).padStart(2, "0") +
    "-" + String(cutoff.getDate()).padStart(2, "0");
  localStorage.setItem(
    "study-pet-sessions",
    JSON.stringify(sessions.filter((s) => s.dateStr >= cutoffStr))
  );
}

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  currentType: sequence[0],
  secondsLeft: getDuration(sequence[0]),
  totalSeconds: getDuration(sequence[0]),
  timerId: null,
  isRunning: false,
  hiddenStart: null,
  strictMode: false,
  stats: loadStats(),
  roundSlacks: [],
  wallStart: null,       // 挂钟计时基准（Date.now()）
  secondsSnapshot: 0,   // wallStart 时对应的 secondsLeft
};

// ─── DOM refs ────────────────────────────────────────────────────────────────

const countdownEl = document.querySelector(".countdown");
const startPauseBtn = document.getElementById("startPauseBtn");
const skipBtn = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");
const focusCountEl = document.getElementById("focusCount");
const totalSlackCountEl = document.getElementById("totalSlackCount");
const roundSlackCountEl = document.getElementById("roundSlackCount");
const slackLogEl = document.getElementById("slackLog");
const petEl = document.getElementById("pet");
const petTextEl = document.getElementById("petText");
const pinBtn = document.getElementById("pinBtn");
const minBtn = document.getElementById("minBtn");
const closeBtn = document.getElementById("closeBtn");
const sessionBadgeEl = document.getElementById("sessionBadge");
const seqProgressEl = document.getElementById("seqProgress");
const progressFillEl = document.getElementById("progressFill");
const settingsToggleBtn = document.getElementById("settingsToggle");
const settingsDrawer = document.getElementById("settingsDrawer");
const inputFocus = document.getElementById("inputFocus");
const inputShort = document.getElementById("inputShort");
const inputLong = document.getElementById("inputLong");
const inputCheckinInterval = document.getElementById("inputCheckinInterval");
const inputBeepVolume = document.getElementById("inputBeepVolume");
const beepVolumeLabel = document.getElementById("beepVolumeLabel");
const seqTrack = document.getElementById("seqTrack");
const seqStandardBtn = document.getElementById("seqStandard");
const seqClearBtn = document.getElementById("seqClear");

// mini bar
const miniDotEl = document.getElementById("miniDot");
const miniTimerEl = document.getElementById("miniTimer");
const miniLabelEl = document.getElementById("miniLabel");
const miniPlayBtn = document.getElementById("miniPlayBtn");
const miniExpandBtn = document.getElementById("miniExpandBtn");
const miniCheckinEl = document.getElementById("miniCheckin");
const miniCheckinBtn = document.getElementById("miniCheckinBtn");
const miniCheckinFillEl = document.getElementById("miniCheckinFill");

const isDesktop = Boolean(window.desktopWidget);

// ─── Render ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function renderTimer() {
  const txt = formatTime(state.secondsLeft);
  countdownEl.textContent = txt;
  const pct =
    state.totalSeconds > 0
      ? ((state.totalSeconds - state.secondsLeft) / state.totalSeconds) * 100
      : 100;
  progressFillEl.style.width = `${pct}%`;
  syncMiniBar();
}

function renderStats() {
  focusCountEl.textContent = String(state.stats.focusCount);
  totalSlackCountEl.textContent = String(state.stats.slackCount);
  renderRoundSlacks();
}

function renderRoundSlacks() {
  roundSlackCountEl.textContent = String(state.roundSlacks.length);
  slackLogEl.innerHTML = "";
  if (state.roundSlacks.length === 0) {
    const li = document.createElement("li");
    li.className = "slack-log-empty";
    li.textContent = "暂无警告，继续保持。";
    slackLogEl.appendChild(li);
    return;
  }
  state.roundSlacks.forEach((entry) => {
    const li = document.createElement("li");
    const time = document.createElement("span");
    time.className = "slack-time";
    time.textContent = entry.time;
    const reason = document.createElement("span");
    reason.className = "slack-reason";
    reason.textContent = entry.reason;
    li.appendChild(time);
    li.appendChild(reason);
    slackLogEl.appendChild(li);
  });
  slackLogEl.scrollTop = slackLogEl.scrollHeight;
}

function renderSessionBadge() {
  const type = sequence[currentSeqIndex];
  const focusNum = sequence
    .slice(0, currentSeqIndex + 1)
    .filter((t) => t === "pomodoro").length;
  let label;
  if (type === "pomodoro") label = `专注 · 第${focusNum}轮`;
  else if (type === "shortBreak") label = "短休时间";
  else label = "长休时间";
  sessionBadgeEl.textContent = label;
  sessionBadgeEl.className = `session-badge ${type}`;
  seqProgressEl.textContent = `${currentSeqIndex + 1} / ${sequence.length}`;
}

function renderSeqTrack() {
  seqTrack.innerHTML = "";
  sequence.forEach((type, idx) => {
    const chip = document.createElement("span");
    chip.className = `seq-chip ${type}${idx === currentSeqIndex ? " active" : ""}`;
    const label = document.createElement("span");
    label.textContent = typeLabels[type];
    chip.appendChild(label);
    const del = document.createElement("button");
    del.className = "seq-chip-del";
    del.textContent = "×";
    del.title = "删除";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSeqItem(idx);
    });
    chip.appendChild(del);
    seqTrack.appendChild(chip);
  });
}

function renderSettingsInputs() {
  inputFocus.value = settings.focus;
  inputShort.value = settings.shortBreak;
  inputLong.value = settings.longBreak;
  inputCheckinInterval.value = settings.checkinInterval;
  inputBeepVolume.value = settings.beepVolume;
  beepVolumeLabel.textContent = `${settings.beepVolume}%`;
}

// ─── Pet ─────────────────────────────────────────────────────────────────────

const petMessages = {
  pomodoro: "专注中，继续保持。",
  shortBreak: "短休时间，放松一下。",
  longBreak: "长休时间，补充能量。",
};

function setPetMood(moodClass, message) {
  if (petEl) {
    petEl.classList.remove("calm", "warn", "strict");
    petEl.classList.add(moodClass);
  }
  if (petTextEl) petTextEl.textContent = message;
}

function updatePetByState() {
  if (state.strictMode) {
    setPetMood("strict", "警告太多了，回到学习页面。");
    return;
  }
  setPetMood("calm", petMessages[state.currentType] || "继续加油。");
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
}

function finishSession() {
  if (!state.isRunning) return; // 防止 tick 与主进程通知同时触发造成重入
  stopTimer();
  playFinishBeep();
  const type = sequence[currentSeqIndex];
  if (type === "pomodoro") {
    state.stats.focusCount += 1;
    saveStats();
    saveFocusSession(settings.focus);
    renderStats();
    notify("专注完成", "你完成了一轮专注，棒极了！");
    setPetMood("calm", "好样的，继续下一轮。");
  } else {
    notify("休息结束", "准备回到专注状态。");
    setPetMood("calm", "休息结束，继续学习。");
  }
  advanceToNext();
}

function advanceToNext() {
  currentSeqIndex = (currentSeqIndex + 1) % sequence.length;
  loadSessionFromSeq();
}

function loadSessionFromSeq() {
  const type = sequence[currentSeqIndex];
  state.currentType = type;
  state.secondsLeft = getDuration(type);
  state.totalSeconds = getDuration(type);
  renderTimer();
  renderSessionBadge();
  renderSeqTrack();
  updatePetByState();
}

function tick() {
  // 午夜自动清零今日数据
  const todayStr = getTodayStr();
  if (state.stats.dateStr !== todayStr) {
    state.stats = { focusCount: 0, slackCount: 0, dateStr: todayStr };
    state.roundSlacks = [];
    saveStats();
    renderStats();
  }
  if (state.wallStart !== null) {
    const elapsed = Math.floor((Date.now() - state.wallStart) / 1000);
    state.secondsLeft = Math.max(0, state.secondsSnapshot - elapsed);
  } else {
    state.secondsLeft -= 1;
  }
  renderTimer();
  if (state.secondsLeft <= 0) finishSession();
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.wallStart = Date.now();
  state.secondsSnapshot = state.secondsLeft;
  state.timerId = window.setInterval(tick, 1000);
  if (isDesktop) {
    const finishLabels = {
      pomodoro: "专注时间结束，休息一下！",
      shortBreak: "短休结束，继续专注！",
      longBreak: "长休结束，继续学习！",
    };
    window.desktopWidget.scheduleFinish(
      Date.now() + state.secondsLeft * 1000,
      finishLabels[state.currentType] || "时间到"
    );
  }
  updateButtons();
  updatePetByState();
}

function stopTimer() {
  // 暂停前先用挂钟时间修正剩余秒数，避免恢复时跳变
  if (state.wallStart !== null) {
    const elapsed = Math.floor((Date.now() - state.wallStart) / 1000);
    state.secondsLeft = Math.max(0, state.secondsSnapshot - elapsed);
  }
  state.isRunning = false;
  state.wallStart = null;
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  if (isDesktop) window.desktopWidget.cancelFinish();
  updateButtons();
}

function resetTimer() {
  stopTimer();
  currentSeqIndex = 0;
  state.strictMode = false;
  state.roundSlacks = [];
  loadSessionFromSeq();
  renderStats();
}

function skipSession() {
  stopTimer();
  advanceToNext();
}

function updateButtons() {
  startPauseBtn.textContent = state.isRunning ? "暂停" : "开始";
  syncMiniBar();
}

// ─── Settings drawer ─────────────────────────────────────────────────────────

let drawerOpen = false;

function toggleDrawer() {
  drawerOpen = !drawerOpen;
  settingsDrawer.classList.toggle("open", drawerOpen);
  settingsToggleBtn.textContent = drawerOpen ? "✕ 关闭" : "⚙ 设置";
}

function applySettings() {
  const f = parseInt(inputFocus.value, 10);
  const s = parseInt(inputShort.value, 10);
  const l = parseInt(inputLong.value, 10);
  const c = parseInt(inputCheckinInterval.value, 10);
  const v = parseInt(inputBeepVolume.value, 10);
  if (f >= 1) settings.focus = f;
  if (s >= 1) settings.shortBreak = s;
  if (l >= 1) settings.longBreak = l;
  if (c >= 1) settings.checkinInterval = c;
  if (v >= 0 && v <= 100) settings.beepVolume = v;
  saveSettings();
  if (!state.isRunning) {
    state.secondsLeft = getDuration(state.currentType);
    state.totalSeconds = getDuration(state.currentType);
    renderTimer();
  }
}

// ─── Sequence builder ────────────────────────────────────────────────────────

function addSeqItem(type) {
  sequence.push(type);
  saveSequence();
  renderSeqTrack();
  renderSessionBadge();
}

function removeSeqItem(idx) {
  if (sequence.length <= 1) return;
  sequence.splice(idx, 1);
  if (currentSeqIndex >= sequence.length) currentSeqIndex = sequence.length - 1;
  saveSequence();
  renderSeqTrack();
  renderSessionBadge();
}

function handleSlack(reason) {
  if (!state.isRunning || state.currentType !== "pomodoro") return;
  state.stats.slackCount += 1;
  saveStats();
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  state.roundSlacks.push({ time: hhmm, reason });
  renderStats();
  setPetMood("warn", "摸鱼被抓到了，回去学习。");
  if (state.roundSlacks.length >= 3) {
    state.strictMode = true;
    setPetMood("strict", "已经三次警告，专注 5 分钟证明你自己。");
  }
}


function syncMiniBar() {
  miniTimerEl.textContent = formatTime(state.secondsLeft);
  const mood = state.strictMode
    ? "strict"
    : state.currentType === "pomodoro"
    ? "calm"
    : "warn";
  miniDotEl.className = `mini-dot ${mood}`;
  const typeText =
    state.currentType === "pomodoro"
      ? "专注"
      : state.currentType === "shortBreak"
      ? "短休"
      : "长休";
  miniLabelEl.textContent = state.isRunning
    ? `${typeText}中`
    : state.secondsLeft === getDuration(state.currentType)
    ? "就绪"
    : "已暂停";
  miniPlayBtn.textContent = state.isRunning ? "⏸" : "▶";
}

function enterMini() {
  document.body.classList.add("mini");
  syncMiniBar();
}

function exitMini() {
  document.body.classList.remove("mini");
}

function bindDesktopControls() {
  if (!isDesktop) {
    pinBtn.style.display = "none";
    minBtn.style.display = "none";
    closeBtn.style.display = "none";
    return;
  }

  window.desktopWidget.isPinned().then((pinned) => {
    pinBtn.textContent = pinned ? "置顶: 开" : "置顶: 关";
  });

  pinBtn.addEventListener("click", async () => {
    const pinned = await window.desktopWidget.togglePin();
    pinBtn.textContent = pinned ? "置顶: 开" : "置顶: 关";
  });

  minBtn.addEventListener("click", () => window.desktopWidget.minimize());
  closeBtn.addEventListener("click", () => window.desktopWidget.close());
}

miniPlayBtn.addEventListener("click", () => {
  if (state.isRunning) stopTimer();
  else startTimer();
});

miniExpandBtn.addEventListener("click", () => {
  if (isDesktop) window.desktopWidget.minimize();
  else exitMini();
});

startPauseBtn.addEventListener("click", () => {
  if (state.isRunning) stopTimer();
  else startTimer();
});

skipBtn.addEventListener("click", skipSession);
resetBtn.addEventListener("click", resetTimer);
settingsToggleBtn.addEventListener("click", toggleDrawer);

inputFocus.addEventListener("change", applySettings);
inputShort.addEventListener("change", applySettings);
inputLong.addEventListener("change", applySettings);

document.querySelectorAll(".chip-add").forEach((btn) => {
  btn.addEventListener("click", () => addSeqItem(btn.dataset.type));
});

inputCheckinInterval.addEventListener("change", applySettings);

inputBeepVolume.addEventListener("input", () => {
  beepVolumeLabel.textContent = `${inputBeepVolume.value}%`;
});
inputBeepVolume.addEventListener("change", () => {
  applySettings();
  playCheckinBeep(); // 松手时播放预览音
});

seqStandardBtn.addEventListener("click", () => {
  sequence = makeStandardSequence();
  currentSeqIndex = 0;
  saveSequence();
  loadSessionFromSeq();
});

seqClearBtn.addEventListener("click", () => {
  if (sequence.length <= 1) return;
  sequence = [sequence[currentSeqIndex]];
  currentSeqIndex = 0;
  saveSequence();
  renderSeqTrack();
  renderSessionBadge();
});

// ─── 手动打卡 ──────────────────────────────────────────────────────────────

const CHECKIN_TIMEOUT = 5; // 5 秒不回应算摸鱼

const checkinOverlay = document.getElementById("checkinOverlay");
const checkinBtn = document.getElementById("checkinBtn");
const checkinBar = document.getElementById("checkinBar");

let checkinTimer = null;
let checkinCountdown = null;
let checkinLeft = 0;

function scheduleCheckin() {
  clearTimeout(checkinTimer);
  if (!state.isRunning || state.currentType !== "pomodoro") return;
  checkinTimer = setTimeout(showCheckin, settings.checkinInterval * 60 * 1000);
}

function playFinishBeep() {
  try {
    const volume = (settings.beepVolume ?? 60) / 100;
    if (volume === 0) return;
    const ctx = new AudioContext();
    const freqs = [523, 659, 784]; // C5 → E5 → G5 三声递升
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      const peak = volume * 2.5;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    // 浏览器不支持 AudioContext 时静默失败
  }
}

function playCheckinBeep() {
  try {
    const volume = (settings.beepVolume ?? 60) / 100;
    if (volume === 0) return;
    const ctx = new AudioContext();
    [0, 150].forEach((delayMs) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      const t = ctx.currentTime + delayMs / 1000;
      // gain 最大允许 3.0，让满量程时明显响亮
      const peak = volume * 3;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {
    // 浏览器不支持 AudioContext 时静默失败
  }
}

function showCheckin() {
  if (!state.isRunning || state.currentType !== "pomodoro") return;
  playCheckinBeep();
  checkinLeft = CHECKIN_TIMEOUT;
  checkinBar.style.width = "100%";
  miniCheckinFillEl.style.width = "100%";
  // 两个 UI 同时激活：CSS `body.mini .checkin-overlay { display:none }` 会在
  // mini 模式下自动屏蔽旧弹窗，无需依赖 isMiniMode 标志的时序正确性
  checkinOverlay.classList.remove("hidden");
  miniCheckinEl.classList.remove("hidden");
  checkinCountdown = setInterval(() => {
    checkinLeft -= 0.5;
    const pct = `${(checkinLeft / CHECKIN_TIMEOUT) * 100}%`;
    checkinBar.style.width = pct;
    miniCheckinFillEl.style.width = pct;
    if (checkinLeft <= 0) {
      dismissCheckin(false);
    }
  }, 500);
}

function dismissCheckin(confirmed) {
  clearInterval(checkinCountdown);
  checkinCountdown = null;
  checkinOverlay.classList.add("hidden");
  miniCheckinEl.classList.add("hidden");
  if (!confirmed) {
    handleSlack("打卡超时未响应");
  }
  scheduleCheckin();
}

checkinBtn.addEventListener("click", () => dismissCheckin(true));
miniCheckinBtn.addEventListener("click", () => dismissCheckin(true));

// 计时器启停时管理打卡调度
const _origStart = startTimer;
const _origStop = stopTimer;

startTimer = function () {
  _origStart();
  scheduleCheckin();
};

stopTimer = function () {
  _origStop();
  clearTimeout(checkinTimer);
  clearInterval(checkinCountdown);
  checkinOverlay.classList.add("hidden");
  miniCheckinEl.classList.add("hidden");
};

// ─── 锁屏检测 ──────────────────────────────────────────────────────────────

if (isDesktop) {
  window.desktopWidget.onScreenLock(() => {
    handleSlack("屏幕锁定/进入屏保");
  });

  window.desktopWidget.onScreenUnlock(() => {
    // 系统唤醒后立即用挂钟时间修正计时器，补上休眠期间流逝的时间
    if (state.isRunning && state.wallStart !== null) {
      const elapsed = Math.floor((Date.now() - state.wallStart) / 1000);
      state.secondsLeft = Math.max(0, state.secondsSnapshot - elapsed);
      renderTimer();
      if (state.secondsLeft <= 0) finishSession();
    }
  });

  // 主进程在锁屏期间检测到计时结束时发出（AudioContext 在锁屏下无法发声时的替代路径）
  window.desktopWidget.onTimerFinished(() => {
    if (state.isRunning) finishSession();
  });
}

if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

if (isDesktop) {
  window.desktopWidget.onMode((mode) => {
    if (mode === "mini") enterMini();
    else exitMini();
  });
}

renderTimer();
renderStats();
renderSessionBadge();
renderSeqTrack();
renderSettingsInputs();
updateButtons();
updatePetByState();
bindDesktopControls();

// ─── Report Modal ─────────────────────────────────────────────────────────────

const reportOverlayEl = document.getElementById("reportOverlay");
const reportChartEl   = document.getElementById("reportChart");
const reportSummaryEl = document.getElementById("reportSummary");
const reportNavLabelEl = document.getElementById("reportNavLabel");
const reportPrevBtn   = document.getElementById("reportPrevBtn");
const reportNextBtn   = document.getElementById("reportNextBtn");

const reportState = { view: "day", cursor: new Date() };

function _dateStr(d) {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

function _addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function _getMondayOf(d) {
  const day = d.getDay();
  return _addDays(d, day === 0 ? -6 : 1 - day);
}

function buildBarChartSVG(values, labels, showEvery) {
  const W = 540, H = 196;
  const padT = 18, padR = 18, padB = 44, padL = 40;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const maxVal = Math.max(...values, 1);
  const rawMax = maxVal <= 30 ? Math.ceil(maxVal / 5) * 5 : Math.ceil(maxVal / 10) * 10;
  const yMax = rawMax || 10;
  const n = values.length;
  const slotW = cW / n;
  const barW = Math.max(3, slotW * 0.7);
  const barOff = (slotW - barW) / 2;

  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;

  // Y grid lines + labels (5 ticks)
  for (let i = 0; i <= 4; i++) {
    const v = yMax * i / 4;
    const y = (padT + cH - (v / yMax) * cH).toFixed(1);
    out += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e4ddd0" stroke-width="1"/>`;
    out += `<text x="${padL - 5}" y="${(parseFloat(y) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#aaa">${Math.round(v)}</text>`;
  }
  // Y axis label
  const midY = (padT + cH / 2).toFixed(1);
  out += `<text x="9" y="${midY}" text-anchor="middle" font-size="10" fill="#aaa" transform="rotate(-90,9,${midY})">分钟</text>`;

  // Bars
  values.forEach((v, i) => {
    const barH = v > 0 ? Math.max((v / yMax) * cH, 3) : 0;
    const x = (padL + i * slotW + barOff).toFixed(1);
    const y = (padT + cH - barH).toFixed(1);
    const bh = barH.toFixed(1);
    const bw = barW.toFixed(1);
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="${v > 0 ? "#19647e" : "#f0ede6"}"/>`;
    if (v > 0 && barH > 18) {
      out += `<text x="${(padL + i * slotW + slotW / 2).toFixed(1)}" y="${(parseFloat(y) - 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="#19647e" font-weight="600">${v}</text>`;
    }
  });

  // X labels
  values.forEach((_, i) => {
    if (showEvery && i % showEvery !== 0) return;
    const x = (padL + (i + 0.5) * slotW).toFixed(1);
    out += `<text x="${x}" y="${H - padB + 15}" text-anchor="middle" font-size="9" fill="#aaa">${labels[i]}</text>`;
  });

  // Axes
  out += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#ccc" stroke-width="1.5"/>`;
  out += `<line x1="${padL}" y1="${padT + cH}" x2="${W - padR}" y2="${padT + cH}" stroke="#ccc" stroke-width="1.5"/>`;
  out += "</svg>";
  return out;
}

function renderReport() {
  const sessions = loadFocusSessions();
  const { view, cursor } = reportState;
  let values = [], labels = [], showEvery = 0, navText = "";
  let totalMins = 0, totalCount = 0;

  if (view === "day") {
    const ds = _dateStr(cursor);
    navText = ds;
    const todaySessions = sessions.filter((s) => s.dateStr === ds);
    values = Array(24).fill(0);
    todaySessions.forEach((s) => { values[s.hour] += s.duration; });
    labels = Array.from({ length: 24 }, (_, i) => String(i));
    showEvery = 4;
    totalMins = values.reduce((a, b) => a + b, 0);
    totalCount = todaySessions.length;

  } else if (view === "week") {
    const monday = _getMondayOf(cursor);
    const sunday = _addDays(monday, 6);
    navText = `${_dateStr(monday)} ~ ${_dateStr(sunday)}`;
    const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    values = Array(7).fill(0);
    labels = dayNames;
    for (let i = 0; i < 7; i++) {
      const ds = _dateStr(_addDays(monday, i));
      sessions.filter((s) => s.dateStr === ds).forEach((s) => {
        values[i] += s.duration;
        totalCount++;
      });
    }
    totalMins = values.reduce((a, b) => a + b, 0);
    showEvery = 0;

  } else {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    navText = `${year} 年 ${month + 1} 月`;
    values = Array(days).fill(0);
    labels = Array.from({ length: days }, (_, i) => String(i + 1));
    showEvery = 5;
    for (let i = 0; i < days; i++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      sessions.filter((s) => s.dateStr === ds).forEach((s) => {
        values[i] += s.duration;
        totalCount++;
      });
    }
    totalMins = values.reduce((a, b) => a + b, 0);
  }

  reportNavLabelEl.textContent = navText;
  reportChartEl.innerHTML = buildBarChartSVG(values, labels, showEvery);
  reportSummaryEl.textContent =
    totalMins > 0
      ? `本期专注总时长 ${totalMins} 分钟（共 ${totalCount} 轮）`
      : "本期暂无专注记录";

  // Disable next btn when at current period
  const today = new Date();
  if (view === "day") {
    reportNextBtn.disabled = _dateStr(cursor) >= _dateStr(today);
  } else if (view === "week") {
    reportNextBtn.disabled = _dateStr(_getMondayOf(cursor)) >= _dateStr(_getMondayOf(today));
  } else {
    reportNextBtn.disabled =
      cursor.getFullYear() === today.getFullYear() &&
      cursor.getMonth() === today.getMonth();
  }
}

function openReport() {
  reportState.view = "day";
  reportState.cursor = new Date();
  reportOverlayEl.querySelectorAll(".report-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === "day")
  );
  reportOverlayEl.classList.remove("hidden");
  renderReport();
}

function closeReport() {
  reportOverlayEl.classList.add("hidden");
}

document.getElementById("reportBtn").addEventListener("click", openReport);
document.getElementById("reportCloseBtn").addEventListener("click", closeReport);
reportOverlayEl.addEventListener("click", (e) => {
  if (e.target === reportOverlayEl) closeReport();
});

reportOverlayEl.querySelectorAll(".report-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    reportOverlayEl.querySelectorAll(".report-tab").forEach((t) =>
      t.classList.remove("active")
    );
    btn.classList.add("active");
    reportState.view = btn.dataset.view;
    reportState.cursor = new Date();
    renderReport();
  });
});

reportPrevBtn.addEventListener("click", () => {
  const { view, cursor } = reportState;
  if (view === "day") reportState.cursor = _addDays(cursor, -1);
  else if (view === "week") reportState.cursor = _addDays(cursor, -7);
  else {
    const d = new Date(cursor);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    reportState.cursor = d;
  }
  renderReport();
});

reportNextBtn.addEventListener("click", () => {
  const { view, cursor } = reportState;
  if (view === "day") reportState.cursor = _addDays(cursor, 1);
  else if (view === "week") reportState.cursor = _addDays(cursor, 7);
  else {
    const d = new Date(cursor);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    reportState.cursor = d;
  }
  renderReport();
});

