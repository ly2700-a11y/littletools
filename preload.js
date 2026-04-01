const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopWidget", {
  togglePin: () => ipcRenderer.invoke("widget:toggle-pin"),
  minimize: () => ipcRenderer.invoke("widget:minimize"),
  close: () => ipcRenderer.invoke("widget:close"),
  isPinned: () => ipcRenderer.invoke("widget:is-pinned"),
});
