const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopWidget", {
  togglePin: () => ipcRenderer.invoke("widget:toggle-pin"),
  minimize: () => ipcRenderer.invoke("widget:minimize"),
  close: () => ipcRenderer.invoke("widget:close"),
  isPinned: () => ipcRenderer.invoke("widget:is-pinned"),
  onMode: (cb) => ipcRenderer.on("widget:mode", (_, mode) => cb(mode)),
  onScreenLock: (cb) => ipcRenderer.on("system:screen-locked", () => cb()),
  onScreenUnlock: (cb) => ipcRenderer.on("system:screen-unlocked", () => cb()),
});
