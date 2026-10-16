const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3300;
const URL = `http://localhost:${PORT}`;

console.log('Memulai FlowRequest Pro Windows Application...');

// 1. Jalankan backend server
const server = require('./server.js');

// 2. Cari executable Microsoft Edge
const possibleEdgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
];

let edgePath = possibleEdgePaths.find(p => fs.existsSync(p));

setTimeout(() => {
  if (edgePath) {
    console.log(`[Windows App] Meluncurkan jendela aplikasi via Microsoft Edge App Mode...`);
    console.log(`Path: ${edgePath}`);
    // Mode --app menjalankan browser sebagai Window Standalone tanpa URL bar / tabs (100% Desktop Window)
    const child = spawn(edgePath, [
      `--app=${URL}`,
      '--window-size=1366,860',
      '--window-position=100,50'
    ], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } else {
    console.log('[Windows App] Membuka URL di peramban standar sistem...');
    exec(`start ${URL}`);
  }
}, 1200);
