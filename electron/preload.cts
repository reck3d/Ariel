import { contextBridge, ipcRenderer } from 'electron';
import type { Conversation, Message } from './types.js';
import type { StreamEvent } from './openrouter.js';

contextBridge.exposeInMainWorld('ariel', {
  windowAction: (action: 'close'|'minimize'|'maximize') => ipcRenderer.send('window:action', action),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: object) => ipcRenderer.invoke('settings:save', settings),
  saveApiKey: (key: string) => ipcRenderer.invoke('key:save', key),
  removeApiKey: () => ipcRenderer.invoke('key:remove'),
  listChats: () => ipcRenderer.invoke('chats:list'),
  saveChat: (conversation: Conversation) => ipcRenderer.invoke('chats:save', conversation),
  deleteChat: (id: string) => ipcRenderer.invoke('chats:delete', id),
  listMemories: () => ipcRenderer.invoke('memory:list'),
  streamChat: (requestId: string, messages: Message[], callback: (event: StreamEvent) => void, continuation=false) => {
    const channel = `chat:event:${requestId}`;
    const listener = (_event: Electron.IpcRendererEvent, event: StreamEvent) => {
      callback(event);
      if (event.type === 'done' || event.type === 'error') ipcRenderer.removeListener(channel, listener);
    };
    ipcRenderer.on(channel, listener);
    ipcRenderer.send('chat:stream', { requestId, messages, continuation });
    return () => ipcRenderer.removeListener(channel, listener);
  },
  localAI: {
    selectExecutable: () => ipcRenderer.invoke('local:select-executable'),
    selectModel: () => ipcRenderer.invoke('local:select-model'),
    start: () => ipcRenderer.invoke('local:start'), stop: () => ipcRenderer.invoke('local:stop'),
    getStatus: () => ipcRenderer.invoke('local:status'), getLogs: () => ipcRenderer.invoke('local:logs'),
    clearLogs: () => ipcRenderer.invoke('local:clear-logs'), openLogFolder: () => ipcRenderer.invoke('local:open-log-folder'), exportLogs: () => ipcRenderer.invoke('local:export-logs'),
    onStatus: (callback: (status: unknown) => void) => { const listener=(_:Electron.IpcRendererEvent,status:unknown)=>callback(status);ipcRenderer.on('local:status-event',listener);return()=>ipcRenderer.removeListener('local:status-event',listener) },
    onLog: (callback: (line: string) => void) => { const listener=(_:Electron.IpcRendererEvent,line:string)=>callback(line);ipcRenderer.on('local:log-event',listener);return()=>ipcRenderer.removeListener('local:log-event',listener) },
    onLogsCleared: (callback: () => void) => { const listener=()=>callback();ipcRenderer.on('local:logs-cleared',listener);return()=>ipcRenderer.removeListener('local:logs-cleared',listener) }
  }
});
