# Ariel

Ariel is a lightweight desktop AI assistant with a playful personality, built with Electron, React, TypeScript, and Vite. Use your own OpenRouter account or run a GGUF model locally through KoboldCpp. Local models can require substantial RAM and GPU memory.

## Screenshots

Screenshots will be added here. Capture a fresh empty conversation without personal messages, credentials, or local file paths before publishing images.

## Features

- Native Electron window with custom close, minimize, and maximize controls.
- Streamed chat responses, persistent conversation history, new chats, and deletion.
- Markdown, syntax-highlighted code blocks, and copy buttons.
- Dark and light themes, persistent settings, and animated empty-chat greeting.
- User-provided OpenRouter key, `openrouter/free` default, and custom OpenRouter model IDs.
- Managed local GGUF inference with an external KoboldCpp executable, native file selection, readiness status, and unload controls.
- Separate normal/code output limits, estimated context budgeting, and Continue / Continue Code for responses ending with `finish_reason: length`.
- Local AI session logs, crash reports, and log export controls.
- Simple explicit-fact memory extraction on the OpenRouter path. The local provider currently uses its own system prompt without injecting the shared memory store.

## Requirements

- Windows x64 is the configured packaging target. Other operating systems are not verified.
- Node.js 20 or later compatible with the lockfile dependencies; Node.js 24 was used for development. `electron-store` requires Node 20+, and Vite 6 supports Node 20 or 22+.
- npm and Git for source installation.
- Internet access to install dependencies and use OpenRouter.
- For local inference: a separately installed KoboldCpp executable, a compatible GGUF model, and sufficient memory. Neither is included in this repository.

The manifest uses Electron 34, React 18, Vite 6, TypeScript 5, and electron-builder 25. Exact resolved versions are recorded in `package-lock.json`.

## Installation for developers

Replace the repository URL below with the URL of this repository after it is published:

```powershell
git clone <your-repository-url> Ariel
cd Ariel
npm install
npm run dev
```

`npm ci` is an alternative for reproducing the locked dependency tree. `npm run dev` first compiles the Electron main process and CommonJS preload, then starts Vite and Electron. Vite serves the renderer on port 5173; keep that port available. Renderer edits use Vite hot reload. Restart the development command after changing Electron code.

If your npm installation requires approval for dependency install scripts, review and allow the Electron and esbuild install scripts so their binaries can be installed.

## Building Ariel

```powershell
npm run typecheck
npm run build
npm run dist
```

`typecheck` checks both renderer and Electron code. `build` checks types, builds the renderer into `dist/`, and compiles Electron into `dist-electron/`. `dist` runs the build and creates Windows NSIS installer and portable targets under `release/`:

- `Ariel-Setup-v2.0.1 beta-x64.exe`
- `Ariel-Portable-v2.0.1 beta-x64.exe`

There is no configured lint command. `npm run preview` previews the Vite renderer only; it does not provide Electron IPC and is not a full desktop-app test. Current builds are unsigned and use the default Electron icon.

During source preparation, the locked dependency install reported 14 vulnerabilities (13 high, 1 critical). Review `npm audit` and validate dependency updates before distributing a production release. Dependencies were not automatically upgraded as part of preparing this source copy.

## API configuration

Open Settings, choose **OpenRouter**, enter your own OpenRouter API key, and click **Save key**. Choose **OpenRouter Free** or **Pick your own** and enter a valid OpenRouter model ID. The custom model field selects a model on OpenRouter; it is not a custom server URL. Provider/model availability and costs depend on your account and OpenRouter.

No developer API key is supplied. Do not commit your API keys to GitHub. Runtime credentials are configured in the app, not through an `.env` file; no `.env.example` is needed for this version.

## Using Ariel with Local AI

### Current local AI support: KoboldCpp

1. Obtain KoboldCpp and a compatible GGUF model separately. Respect the model's license.
2. Open Settings and select **Local GGUF**.
3. Browse for the KoboldCpp `.exe` and the `.gguf` model.
4. Configure context size (default 2048), GPU layers (-1 / auto), normal max output (384), code max output (1024), and port (5001).
5. Click **Load Model** and wait for **Ready** before sending a message.
6. Use **Unload Model** to stop the process started by Ariel. Local AI logs can be viewed, copied, exported, or opened from Settings.

Ariel launches KoboldCpp using `--model`, `--port`, `--host 127.0.0.1`, `--contextsize`, `--gpulayers`, `--usevulkan`, and `--skiplauncher`. Executable filenames containing an old-PC marker such as `oldpc` also receive `--noavx2`. The current launcher always selects Vulkan; there is no CPU/CUDA backend selector. CLI compatibility was checked against KoboldCpp 1.120.

The main process polls `http://127.0.0.1:<port>/v1/models` and streams requests to `/v1/chat/completions`. An API key is not required for this managed local endpoint. Switch providers in Settings without restarting Ariel; switching providers does not automatically unload a loaded model.

Output caps reduce total generation length, not tokens-per-second. The local provider estimates prompt tokens, reserves a margin, and reduces the requested output to fit the configured context. This is an approximation, not exact tokenization. Near-full conversations may require a new chat. Continue requests append generated text; models may still repeat content or produce incomplete code.

### Ollama — not directly configurable in this version

Install [Ollama](https://ollama.com/), download a model, and start its local service:

```powershell
ollama pull llama3.2:3b
ollama serve
```

If Ollama is already running, another `serve` process is unnecessary. Its OpenAI-compatible chat endpoint is normally `http://localhost:11434/v1/chat/completions`. Ariel would need a custom base URL of `http://localhost:11434/v1`, model name `llama3.2:3b`, and optional local authentication to connect. These fields are not available in Ariel today. See [Ollama's compatibility documentation](https://ollama.com/blog/openai-compatibility).

### LM Studio — not directly configurable in this version

Install LM Studio, download a compatible model, load it, and start the API server in its developer/local-server interface. The common OpenAI-compatible base URL is `http://localhost:1234/v1`; use the model identifier exposed by that server. Ariel cannot currently enter this URL in Settings. See [LM Studio server documentation](https://lmstudio.ai/docs/developer/core/server) and [API documentation](https://lmstudio.ai/docs/developer).

### Other OpenAI-compatible servers and developer notes

API compatibility alone is insufficient: Ariel currently requires a managed KoboldCpp process to be Ready and does not accept an arbitrary base URL. Adding external-server support requires persistent base URL/model/authentication settings in `electron/types.ts`, `electron/storage.ts`, and `src/types.ts`; controls in `SettingsPanel.tsx`; validated IPC through `main.ts`/`preload.cts`; and an external provider branch in `openrouter.ts` or a shared provider service. Reuse streaming and chat persistence, make authentication optional for local servers, and keep externally managed servers separate from the KoboldCpp process lifecycle. No Ollama or LM Studio integration is claimed by this release.

## Security

Ariel must not ship with developer credentials. Users supply their own keys; secrets and `.env` files must stay out of Git. API requests run in Electron's main process with context isolation and a restricted preload bridge.

Keys are encrypted with Electron `safeStorage` when available. The current implementation falls back to plaintext local storage if encryption is unavailable. Conversation history and memory are also stored locally without application-level encryption. Treat Electron's user-data folder and diagnostic exports as private.

Fully local inference can keep model requests on your machine. OpenRouter sends prompts, selected conversation context, and applicable memory to the cloud provider. The renderer imports Google Fonts, so local inference does not imply the entire application makes no network requests. KoboldCpp diagnostics may include prompts or generated text; review logs before sharing them.

Settings and conversations use `ariel-data.json` under Electron's user-data directory (normally `%APPDATA%/ariel` on Windows). Local AI logs live in its `logs/local-ai/` subdirectory; the implementation retains up to ten session logs and ten crash reports. Do not publish that directory.

## Project structure

```text
Ariel/
├── electron/              # Main process, preload, providers, storage, process manager
├── src/
│   ├── components/        # Chat, settings, sidebar, title bar, composer
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.ts
├── .gitignore
└── README.md
```

Local debugging scripts and screenshots containing machine-specific data are not part of this source distribution. No existing project license was present; choose and add a license before representing the project as licensed open-source software.

## Releases

Build with `npm run dist`, then attach the installer and portable executable to a GitHub Release. Users should download compiled apps from Releases. Do not commit executables, `release/`, `node_modules/`, models, or build output to the source repository. This source copy does not upload or publish anything automatically.
