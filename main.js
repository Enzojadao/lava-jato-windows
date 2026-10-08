// App do Lava-Jato para Windows: abre o sistema publicado numa janela própria.
// Os dados ficam no servidor (os mesmos do site e do celular) e as telas se
// atualizam sozinhas a cada publicação, sem precisar reinstalar o programa.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SITE = 'https://lava-jato-mu-three.vercel.app';
const ORIGEM = new URL(SITE).origin;

// uma janela só: abrir o atalho de novo traz a janela existente para a frente
if (!app.requestSingleInstanceLock()) app.quit();

let janela;

// lembra o tamanho e a posição da janela entre uma abertura e outra
const arqEstado = () => path.join(app.getPath('userData'), 'janela.json');
function lerEstado() {
  try { return JSON.parse(fs.readFileSync(arqEstado(), 'utf8')); } catch { return { width: 1280, height: 820 }; }
}
function salvarEstado() {
  if (!janela || janela.isDestroyed()) return;
  try { fs.writeFileSync(arqEstado(), JSON.stringify({ ...janela.getNormalBounds(), max: janela.isMaximized() })); } catch {}
}

function criarJanela() {
  const e = lerEstado();
  janela = new BrowserWindow({
    x: e.x, y: e.y, width: e.width || 1280, height: e.height || 820,
    minWidth: 380, minHeight: 560,
    title: 'Lava-Jato',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0e0e10',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (e.max) janela.maximize();
  janela.once('ready-to-show', () => janela.show());
  ['resize', 'move', 'close'].forEach((ev) => janela.on(ev, salvarEstado));

  // links de fora do sistema (WhatsApp, sites) abrem no navegador padrão do Windows
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && new URL(url).origin !== ORIGEM) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (ev, url) => {
    if (url.startsWith('file:')) return;               // página "sem internet"
    if (new URL(url).origin !== ORIGEM) { ev.preventDefault(); shell.openExternal(url); }
  });

  // sem internet: mostra uma tela com "Tentar de novo"
  janela.webContents.on('did-fail-load', (ev, codigo, desc, url, principal) => {
    if (principal && codigo !== -3) janela.loadFile(path.join(__dirname, 'offline.html'));
  });

  // a câmera do notebook pode ser usada na vistoria; outras permissões ficam negadas
  janela.webContents.session.setPermissionRequestHandler((wc, perm, ok) => {
    ok(['media', 'clipboard-sanitized-write', 'fullscreen'].includes(perm) && wc.getURL().startsWith(ORIGEM));
  });

  janela.loadURL(SITE);
}

function montarMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Lava-Jato',
      submenu: [
        { label: 'Recarregar', accelerator: 'F5', click: () => janela && janela.loadURL(SITE) },
        { type: 'separator' },
        { label: 'Aumentar zoom', accelerator: 'Ctrl+=', role: 'zoomIn' },
        { label: 'Diminuir zoom', accelerator: 'Ctrl+-', role: 'zoomOut' },
        { label: 'Zoom normal', accelerator: 'Ctrl+0', role: 'resetZoom' },
        { label: 'Tela cheia', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Sobre', click: () => dialog.showMessageBox(janela, { type: 'info', title: 'Lava-Jato', message: `Lava-Jato ${app.getVersion()}`, detail: `Sistema: ${SITE}` }) },
        { label: 'Sair', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }] },
  ]);
  Menu.setApplicationMenu(menu);
}

app.on('second-instance', () => {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.focus();
});

app.whenReady().then(() => {
  app.setAppUserModelId('app.lavajato.sistema');   // nome e ícone certos na barra de tarefas
  montarMenu();
  criarJanela();
});

app.on('window-all-closed', () => app.quit());
