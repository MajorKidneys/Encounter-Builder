const { contextBridge, ipcRenderer } = require("electron");

// The page's only door to the data file on disk. Keys are the same ones the browser
// version keeps in localStorage.
contextBridge.exposeInMainWorld("encounterStore", {
  getAll: () => ipcRenderer.invoke("store:getAll"),
  set: (key, value) => ipcRenderer.invoke("store:set", key, value),
  remove: (key) => ipcRenderer.invoke("store:remove", key),
  onChanged: (callback) => {
    const handler = (_event, changes) => callback(changes);
    ipcRenderer.on("store:changed", handler);
    return () => ipcRenderer.removeListener("store:changed", handler);
  },
});
