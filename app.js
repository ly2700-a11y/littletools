const modeDurations = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const modeLabels = {
  pomodoro: "专注中，继续保持。",
  shortBreak: "短休时间，放松一下。",
  longBreak: "长休时间，补充能量。",
};

const state = {
  mode: "pomodoro",
  secondsLeft: modeDurations.pomodoro,
  timerId: null,
  isRunning: false,
  hiddenStart: null,
  strictMode: false,
  stats: loadStats(),
};

const countdownEl = document.querySelector(".countdown");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
const focusCountEl = document.getElementById("focusCount");
const slackCountEl = document.getElementById("slackCount");
const petEl = document.getElementById("pet");
const petTextEl = document.getElementById("petText");
const pinBtn = document.getElementById("pinBtn");
const minBtn = document.getElementById("minBtn");
const closeBtn = document.getElementById("closeBtn");

const isDesktop = Boolean(window.desktopWidget);

function loadStats() {
  const raw = localStorage.getItem("study-pet-stats");
  if (!raw) {
    return { focusCount: 0, slackCount: 0 };
  }

  try {
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

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderTimer() {
  countdownEl.textContent = formatTime(state.secondsLeft);
}

function renderStats() {
  focusCountEl.textContent = String(state.stats.focusCount);
  slackCountEl.textContent = String(state.stats.slackCount);
}

function setPetMood(type, message) {
  petEl.classList.remove("calm", "warn", "strict");
  petEl.classList.add(type);
  petTextEl.textContent = message;
}

function updatePetByState() {
  if (state.strictMode) {
    setPetMood("strict", "警告太多了，回到学习页面。");
    return;
  }

  if (state.mode === "pomodoro") {
    setPetMood("calm", modeLabels.pomodoro);
    return;
  }

  setPetMood("calm", modeLabels[state.mode]);
}

function updateButtons() {
  startPauseBtn.textContent = state.isRunning ? "暂停" : "开始";
}

function switchMode(newMode) {
  state.mode = newMode;
  state.secondsLeft = modeDurations[newMode];
  stopTimer();
  state.strictMode = false;

  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === newMode);
  });

  renderTimer();
  updateButtons();
  updatePetByState();
}

function notify(title, body) {
  if (!("Notification" in window)) {
    return;
  }
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function finishRound() {
  stopTimer();

  if (state.mode === "pomodoro") {
    state.stats.focusCount += 1;
    saveStats();
    renderStats();
    notify("专注完成", "你完成了一个番茄钟，太棒了。");
    setPetMood("calm", "好样的，再来一轮。");
    return;
  }

  notify("休息结束", "准备回到专注状态。");
  setPetMood("calm", "休息结束，继续学习。 ");
}

function tick() {
  state.secondsLeft -= 1;
  renderTimer();

  if (state.secondsLeft <= 0) {
    finishRound();
  }
}

function startTimer() {
  if (state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.timerId = window.setInterval(tick, 1000);
  updateButtons();
  updatePetByState();
}

function stopTimer() {
  state.isRunning = false;
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  updateButtons();
}

function resetTimer() {
  stopTimer();
  state.secondsLeft = modeDurations[state.mode];
  state.strictMode = false;
  renderTimer();
  updatePetByState();
}

function onVisibilityChanged() {
  if (!state.isRunning || state.mode !== "pomodoro") {
    state.hiddenStart = null;
    return;
  }

  if (document.hidden) {
    state.hiddenStart = Date.now();
    return;
  }

  if (!state.hiddenStart) {
    return;
  }

  const hiddenForMs = Date.now() - state.hiddenStart;
  state.hiddenStart = null;

  if (hiddenForMs >= 12000) {
    state.stats.slackCount += 1;
    saveStats();
    renderStats();
    setPetMood("warn", "摸鱼被抓到了，回去学习。 ");

    if (state.stats.slackCount >= 3) {
      state.strictMode = true;
      setPetMood("strict", "已经三次警告，专注 5 分钟证明你自己。 ");
    }
  } else {
    updatePetByState();
  }
}

function onFocusLoss(startTime) {
  if (!state.isRunning || state.mode !== "pomodoro") {
    return;
  }

  const hiddenForMs = Date.now() - startTime;
  if (hiddenForMs < 12000) {
    updatePetByState();
    return;
  }

  state.stats.slackCount += 1;
  saveStats();
  renderStats();
  setPetMood("warn", "摸鱼被抓到了，回去学习。");

  if (state.stats.slackCount >= 3) {
    state.strictMode = true;
    setPetMood("strict", "已经三次警告，专注 5 分钟证明你自己。");
  }
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

  minBtn.addEventListener("click", () => {
    window.desktopWidget.minimize();
  });

  closeBtn.addEventListener("click", () => {
    window.desktopWidget.close();
  });
}

startPauseBtn.addEventListener("click", () => {
  if (state.isRunning) {
    stopTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener("click", resetTimer);

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

document.addEventListener("visibilitychange", onVisibilityChanged);

let blurStart = null;
window.addEventListener("blur", () => {
  blurStart = Date.now();
});

window.addEventListener("focus", () => {
  if (!blurStart) {
    return;
  }
  const start = blurStart;
  blurStart = null;
  onFocusLoss(start);
});

if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

renderTimer();
renderStats();
updateButtons();
updatePetByState();
bindDesktopControls();
