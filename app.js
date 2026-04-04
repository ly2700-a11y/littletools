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
  { focus: 25, shortBreak: 5, longBreak: 15, checkInterval: 10 },
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

function loadStats() {
  try {
    const raw = localStorage.getItem("study-pet-stats");
    if (!raw) return { focusCount: 0, slackCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      focusCount: Number(parsed.focusCount) || 0,
      slackCount: Number(parsed.slackCount) || 0,
    };
  } catch {
    return { focusCount: 0, slackCount: 0 };
  }
}

function saveStats() {
  localStorage.setItem("study-pet-stats", JSON.stringify(state.stats));
}

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  currentType: sequence[0],
  secondsLeft: getDuration(sequence[0]),
  totalSeconds: getDuration(sequence[0]),
  timerId: null,
  isRunning: false,
  checkTimerId: null,
  focusCheckCountdownId: null,
  strictMode: false,
  stats: loadStats(),
  roundSlacks: [],
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
const inputCheck = document.getElementById("inputCheck");
const seqTrack = document.getElementById("seqTrack");
const seqStandardBtn = document.getElementById("seqStandard");
const seqClearBtn = document.getElementById("seqClear");
const focusCheckModalEl = document.getElementById("focusCheckModal");
const focusCheckTimerEl = document.getElementById("focusCheckTimer");
const focusCheckConfirmBtn = document.getElementById("focusCheckConfirm");

// mini bar
const miniDotEl = document.getElementById("miniDot");
const miniTimerEl = document.getElementById("miniTimer");
const miniLabelEl = document.getElementById("miniLabel");
const miniPlayBtn = document.getElementById("miniPlayBtn");
const miniExpandBtn = document.getElementById("miniExpandBtn");

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
  inputCheck.value = settings.checkInterval;
}

// ─── Pet ─────────────────────────────────────────────────────────────────────

const petMessages = {
  pomodoro: "专注中，继续保持。",
  shortBreak: "短休时间，放松一下。",
  longBreak: "长休时间，补充能量。",
};

function setPetMood(moodClass, message) {
  petEl.classList.remove("calm", "warn", "strict");
  petEl.classList.add(moodClass);
  petTextEl.textContent = message;
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
  stopTimer();
  const type = sequence[currentSeqIndex];
  if (type === "pomodoro") {
    state.stats.focusCount += 1;
    saveStats();
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
  state.secondsLeft -= 1;
  renderTimer();
  if (state.secondsLeft <= 0) finishSession();
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.timerId = window.setInterval(tick, 1000);
  startCheckTimer();
  updateButtons();
  updatePetByState();
}

function stopTimer() {
  state.isRunning = false;
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  stopCheckTimer();
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
  const c = parseInt(inputCheck.value, 10);
  if (f >= 1) settings.focus = f;
  if (s >= 1) settings.shortBreak = s;
  if (l >= 1) settings.longBreak = l;
  if (c >= 1) settings.checkInterval = c;
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

function handleSlack() {
  if (!state.isRunning || state.currentType !== "pomodoro") return;
  state.stats.slackCount += 1;
  saveStats();
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  state.roundSlacks.push({ time: hhmm, reason: "未在时限内确认专注状态" });
  renderStats();
  setPetMood("warn", "摸鱼被抓到了，回去学习。");
  if (state.roundSlacks.length >= 3) {
    state.strictMode = true;
    setPetMood("strict", "已经三次警告，专注 5 分钟证明你自己。");
  }
}

function dismissFocusCheckModal() {
  if (state.focusCheckCountdownId !== null) {
    window.clearInterval(state.focusCheckCountdownId);
    state.focusCheckCountdownId = null;
  }
  focusCheckModalEl.classList.remove("visible");
}

function showFocusCheckModal() {
  if (!state.isRunning || state.currentType !== "pomodoro") return;
  let remaining = 5;
  focusCheckTimerEl.textContent = String(remaining);
  focusCheckModalEl.classList.add("visible");
  state.focusCheckCountdownId = window.setInterval(() => {
    remaining -= 1;
    focusCheckTimerEl.textContent = String(remaining);
    if (remaining <= 0) {
      dismissFocusCheckModal();
      handleSlack();
    }
  }, 1000);
}

function startCheckTimer() {
  stopCheckTimer();
  if (state.currentType !== "pomodoro") return;
  state.checkTimerId = window.setInterval(showFocusCheckModal, settings.checkInterval * 60 * 1000);
}

function stopCheckTimer() {
  if (state.checkTimerId !== null) {
    window.clearInterval(state.checkTimerId);
    state.checkTimerId = null;
  }
  dismissFocusCheckModal();
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
inputCheck.addEventListener("change", applySettings);

focusCheckConfirmBtn.addEventListener("click", () => {
  dismissFocusCheckModal();
});

document.querySelectorAll(".chip-add").forEach((btn) => {
  btn.addEventListener("click", () => addSeqItem(btn.dataset.type));
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
