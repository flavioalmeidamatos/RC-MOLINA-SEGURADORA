const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("diagnosticDesktop", {
  version: "0.1.0"
});
