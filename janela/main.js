const { app, BrowserWindow, screen } = require('electron');

function createWindow() {
  // Pega a tela principal e sua área útil (descontando a barra do Windows)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  // ==========================================
  // CÁLCULO DINÂMICO DE LIMITES
  // ==========================================
  const flagSidebar = process.argv.find(a => a.startsWith('--sidebar='));
  const sidebarWidth = flagSidebar ? parseInt(flagSidebar.split('=')[1], 10) : 350;
  
  // A janela vai ocupar o resto da tela
  const windowWidth = screenWidth - sidebarWidth;
  const windowHeight = screenHeight;

  // Cria a janela
  const win = new BrowserWindow({
    // Define a posição: X = depois da sidebar, Y = topo
    x: sidebarWidth,
    y: 0,
    
    // Define o tamanho restante
    width: windowWidth,
    height: windowHeight,
    
    // ==========================================
    // MAGIA DO ELECTRON: Controle total da UI
    // ==========================================
    resizable: false,      // BLOQUEIO TOTAL: O usuário não consegue redimensionar
    maximizable: false,    // Desabilita o botão de maximizar
    autoHideMenuBar: true, // Esconde a barra de menu (Arquivo, Editar...)
    
    // (Opcional) frame: false deixaria sem a barra superior do Windows
    // frame: false, 

    webPreferences: {
      // Segurança: impede que o site externo rode scripts Node.js na sua máquina
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 1. Carrega o site diretamente (NÃO USA IFRAME, portanto ignora os bloqueios de segurança do site)
  win.loadURL('https://solutions.hcommerce.com.br/dashboard');

  // 2. Assim que o site carregar, injeta um CSS personalizado!
  // O Google Chrome JAMAIS permitiria que você fizesse isso de fora para dentro.
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      /* Remove completamente as barras de rolagem vertical e horizontal */
      body { overflow: hidden !important; }
      
      /* Esconde os elementos visuais de scrollbar no Webkit */
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    `);
  });
}

// Inicia o app quando o Electron estiver pronto
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Encerra o processo quando a janela for fechada (Windows/Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
