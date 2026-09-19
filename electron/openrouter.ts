import type { Message } from './types.js';
import { getApiKey, getMemories, getSettings, addMemories } from './storage.js';
import { localLlmManager } from './localLlmManager.js';

const PERSONALITY = `You are Ariel, a playful, witty female assistant. Be casual, warm, expressive, occasionally sarcastic or dramatically amused, but always genuinely helpful. Tease lightly when appropriate. Never default to romantic or sexual behavior. Avoid corporate stiffness and do not repeatedly announce that you are an AI. Keep jokes natural, not constant. Respect the user's requested tone and be precise for technical work.`;
export type StreamEvent = { type: 'delta'; text: string } | { type: 'done'; truncated?: boolean; coding?: boolean; finishReason?: string } | { type: 'error'; message: string };

function friendlyError(status?: number, raw?: string) {
  if (status === 401 || status === 403) return "That API key isn't working. Tiny key-shaped tragedy.";
  if (status === 429) return 'We bullied the API too much. Try again in a bit.';
  if (!status) return 'Internet decided to disappear. Very theatrical of it.';
  return `OpenRouter had a moment (${status}). ${raw?.slice(0, 120) || 'Try again shortly.'}`;
}
function context(messages: Message[]) { let size = 0; const chosen: Message[] = []; for (let i = messages.length - 1; i >= 0; i--) { size += messages[i].content.length; if (size > 24000 && chosen.length >= 8) break; chosen.unshift(messages[i]); } return chosen; }
export async function streamChat(messages: Message[], send: (e: StreamEvent) => void, continuation=false) {
  const selected = getSettings();
  if (selected.provider === 'local') { await localLlmManager.stream(messages, send, continuation); return; }
  const key = getApiKey(); if (!key) { send({ type: 'error', message: 'Give me an API key first, genius.' }); return; }
  const settings = getSettings(); const model = settings.modelMode === 'custom' && settings.customModel.trim() ? settings.customModel.trim() : 'openrouter/free';
  const memories = getMemories(); const memoryText = memories.length ? `\nUseful facts the user asked you to remember or that were explicitly stated:\n${memories.map(m => `- ${m.text}`).join('\n')}` : '';
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ariel.local', 'X-Title': 'Ariel' }, body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: PERSONALITY + memoryText }, ...context(messages).map(({role,content}) => ({role,content}))] }) });
    if (!response.ok || !response.body) { send({ type: 'error', message: friendlyError(response.status, await response.text()) }); return; }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data: ')) continue; const data = line.slice(6); if (data === '[DONE]') continue; try { const text = JSON.parse(data).choices?.[0]?.delta?.content; if (text) send({ type: 'delta', text }); } catch { /* incomplete provider event */ } } }
    send({ type: 'done' });
    extractExplicitMemories(messages);
  } catch { send({ type: 'error', message: friendlyError() }); }
}
function extractExplicitMemories(messages: Message[]) { const last = [...messages].reverse().find(m => m.role === 'user')?.content || ''; const patterns = [/\bremember (?:that )?(.+?)(?:[.!?]|$)/gi, /\b(?:i like|i love|i prefer|my favorite is|i am building|i'm building)\s+(.+?)(?:[.!?]|$)/gi]; const found: string[] = []; for (const p of patterns) for (const match of last.matchAll(p)) { const fact = match[0].trim(); if (fact.length >= 8 && fact.length <= 180) found.push(fact); } if (found.length) addMemories(found); }
