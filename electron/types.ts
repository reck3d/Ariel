export type Role = 'user' | 'assistant';
export type Provider = 'openrouter' | 'local';
export type LocalAIState = 'stopped' | 'starting' | 'ready' | 'error' | 'crashed';
export interface Message { id: string; role: Role; content: string; createdAt: number; truncated?: boolean; coding?: boolean }
export interface Conversation { id: string; title: string; messages: Message[]; createdAt: number; updatedAt: number }
export interface Memory { id: string; text: string; createdAt: number }
export interface LocalAISettings { executablePath: string; modelPath: string; contextSize: number; gpuLayers: number; normalMaxOutput: number; codeMaxOutput: number; port: number }
export interface Settings { theme: 'dark' | 'light'; provider: Provider; modelMode: 'free' | 'custom'; customModel: string; localAI: LocalAISettings; hasApiKey: boolean; maskedApiKey?: string }
export interface LocalAIStatus { state: LocalAIState; message: string; pid?: number; backend?: string; modelFilename?: string; modelSize?: number; startedAt?: number; readyAt?: number; crashLog?: string; previousCrashLog?: string }
export interface AppData { settings: Omit<Settings, 'hasApiKey' | 'maskedApiKey'>; apiKeyEncrypted?: string; apiKeyPlainFallback?: string; conversations: Conversation[]; memories: Memory[] }
