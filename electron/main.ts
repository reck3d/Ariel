import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteConversation, getConversations, getMemories, getSettings, removeApiKey, saveApiKey, saveConversation, saveSettings } from './storage.js';
import { streamChat } from './openrouter.js';
import { localLlmManager } from './localLlmManager.js';
import type { Conversation, Message } from './types.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let win: BrowserWindow | null = null;
function createWindow() {
  win = new BrowserWindow({ width: 1180, height: 780, minWidth: 760, minHeight: 560, frame: false, transparent: false, backgroundColor: '#0b0c0f', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.once('ready-to-show', () => win?.show());
  win.webContents.on('did-fail-load', (_event, code, description, url) => console.error('[renderer] load failed', { code, description, url }));
  win.webContents.on('render-process-gone', (_event, details) => console.error('[renderer] process gone', details));
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => { if (level >= 2) console.error('[renderer console]', { level, message, line, sourceId }); });
  const load = process.env.VITE_DEV_SERVER_URL ? win.loadURL(process.env.VITE_DEV_SERVER_URL) : win.loadFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
  void load.catch(error => console.error('[renderer] unable to load entry point', error));
}
app.whenReady().then(() => { localLlmManager.initialize(); registerIpc(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); }); app.on('before-quit', () => { void localLlmManager.stop(); }); app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
function validId(v: unknown): v is string { return typeof v === 'string' && v.length > 0 && v.length < 100; }
function validConversation(v: unknown): v is Conversation { const c = v as Conversation; return Boolean(c && validId(c.id) && typeof c.title === 'string' && c.title.length <= 100 && Array.isArray(c.messages) && c.messages.length <= 10000); }
function registerIpc() {
  ipcMain.on('window:action', (_e, action) => { if (!['close','minimize','maximize'].includes(action)) return; if (action === 'close') win?.close(); if (action === 'minimize') win?.minimize(); if (action === 'maximize') win?.isMaximized() ? win.unmaximize() : win?.maximize(); });
  ipcMain.handle('settings:get', () => getSettings()); ipcMain.handle('settings:save', (_e, s) => saveSettings(s)); ipcMain.handle('key:save', (_e, k) => { if (typeof k !== 'string') throw new Error('Invalid key'); return saveApiKey(k); }); ipcMain.handle('key:remove', () => removeApiKey());
  ipcMain.handle('chats:list', () => getConversations()); ipcMain.handle('chats:save', (_e, c) => { if (!validConversation(c)) throw new Error('Invalid conversation'); return saveConversation(c); }); ipcMain.handle('chats:delete', (_e, id) => { if (validId(id)) deleteConversation(id); }); ipcMain.handle('memory:list', () => getMemories());
  ipcMain.on('chat:stream', (e, payload: { requestId: string; messages: Message[]; continuation?: boolean }) => { if (!payload || !validId(payload.requestId) || !Array.isArray(payload.messages) || payload.messages.length > 10000) return; void streamChat(payload.messages, event => { if (!e.sender.isDestroyed()) e.sender.send(`chat:event:${payload.requestId}`, event); }, payload.continuation === true); });
  ipcMain.handle('local:select-executable', () => localLlmManager.selectExecutable());
  ipcMain.handle('local:select-model', () => localLlmManager.selectModel());
  ipcMain.handle('local:start', () => localLlmManager.start());
  ipcMain.handle('local:stop', () => localLlmManager.stop());
  ipcMain.handle('local:status', () => localLlmManager.getStatus());
  ipcMain.handle('local:logs', () => localLlmManager.getLogs());
  ipcMain.handle('local:clear-logs', () => localLlmManager.clearLogs());
  ipcMain.handle('local:open-log-folder', () => localLlmManager.openLogFolder());
  ipcMain.handle('local:export-logs', () => localLlmManager.exportLogs());
  localLlmManager.on('status', status => win?.webContents.send('local:status-event', status));
  localLlmManager.on('log', line => win?.webContents.send('local:log-event', line));
  localLlmManager.on('logs-cleared', () => win?.webContents.send('local:logs-cleared'));
}
