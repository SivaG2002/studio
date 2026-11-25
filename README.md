# NOX AI

NOX AI is a Next.js App Router application built with React and TypeScript. It includes a terminal-style interface, notes, settings, and an AI chat.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `OPENROUTER_API_KEY` in `.env.local` to your OpenRouter API key. Keep it server-side; do not use a `NEXT_PUBLIC_` variable.
3. Optionally change `OPENROUTER_MODEL` in `.env.local`. It defaults to `openrouter/free`.
4. Run `npm run dev` and open `http://localhost:9002`.

The AI conversation appears directly in the terminal transcript: ordinary text prompts receive streamed AI responses, while built-in commands such as `help`, `echo`, and `cls` continue to work. Conversation history is stored in the browser's local storage; it is not synced to a database. Clear the current conversation with **Clear chat**, or remove all locally saved conversations with **Clear memory**.
