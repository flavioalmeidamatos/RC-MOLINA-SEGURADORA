const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rcMolinaDesktop', {
  isDesktopShell: true,
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  openSolutionsEmbedded: (payload) => ipcRenderer.invoke('solutions:open-embedded', payload),
  updateSolutionsEmbeddedBounds: (payload) => ipcRenderer.invoke('solutions:update-embedded-bounds', payload),
  closeSolutionsEmbedded: () => ipcRenderer.invoke('solutions:close-embedded'),
  onSolutionsEmbeddedClosed: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('solutions:embedded-closed', listener);

    return () => {
      ipcRenderer.removeListener('solutions:embedded-closed', listener);
    };
  },
});
