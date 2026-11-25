import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_TOTAL_LENGTH = 24_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;
const MAX_RATE_LIMIT_ENTRIES = 5_000;

type ChatRole = "user" | "assistant";
type ChatRequestMessage = { role: ChatRole; content: string };

const rateLimitEntries = new Map<string, { count: number; resetAt: number }>();

function errorResponse(message: string, status: number) {
  return Response.json({ error: { message } }, { status });
}

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const address = forwardedFor?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return address.slice(0, 128);
}

function isRateLimited(request: NextRequest): boolean {
  const now = Date.now();

  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) rateLimitEntries.delete(key);
  }

  const key = getClientKey(request);
  const current = rateLimitEntries.get(key);

  if (current && current.count >= RATE_LIMIT_REQUESTS) return true;
  if (!current && rateLimitEntries.size >= MAX_RATE_LIMIT_ENTRIES) return true;

  rateLimitEntries.set(key, current
    ? { ...current, count: current.count + 1 }
    : { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });

  return false;
}

async function readRequestBody(request: NextRequest): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("Request body is too large.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function validateMessages(body: unknown): ChatRequestMessage[] | null {
  if (!body || typeof body !== "object" || !("messages" in body)) return null;
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return null;
  }

  let totalLength = 0;
  const validated: ChatRequestMessage[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") return null;
    const { role, content } = message as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;

    const trimmedContent = content.trim();
    if (!trimmedContent || trimmedContent.length > MAX_MESSAGE_LENGTH) {
      return null;
    }

    totalLength += trimmedContent.length;
    if (totalLength > MAX_TOTAL_LENGTH) return null;

    validated.push({ role, content: trimmedContent });
  }

  return validated[validated.length - 1].role === "user" ? validated : null;
}

function getUpstreamError(status: number): { status: number; message: string } {
  if (status === 401) {
    return { status: 401, message: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in your server environment." };
  }
  if (status === 402) {
    return { status: 402, message: "OpenRouter reports that this request has no available credits." };
  }
  if (status === 429) {
    return { status: 429, message: "The AI service is busy. Please wait a moment and try again." };
  }
  if (status >= 500) {
    return { status: 500, message: "The AI service is temporarily unavailable. Please try again." };
  }
  return { status: 502, message: "The AI request could not be completed. Please try again." };
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Request must use application/json.", 415);
  }

  if (isRateLimited(request)) {
    return errorResponse("Too many requests. Please wait a minute and try again.", 429);
  }

  let body: unknown;
  try {
    body = await readRequestBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return errorResponse(message, message === "Request body is too large." ? 413 : 400);
  }

  const messages = validateMessages(body);
  if (!messages) {
    return errorResponse("Provide up to 40 valid user or assistant messages, ending with a user message.", 400);
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey === "your_api_key_here") {
    return errorResponse("OpenRouter is not configured. Add OPENROUTER_API_KEY to the server environment.", 503);
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
  let upstream: Response;

  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: request.signal,
    });
  } catch {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return errorResponse("Could not connect to the AI service. Please try again.", 502);
  }

  if (!upstream.ok) {
    await upstream.body?.cancel();
    const error = getUpstreamError(upstream.status);
    return errorResponse(error.message, error.status);
  }

  if (!upstream.body) {
    return errorResponse("The AI service did not return a response stream.", 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
}
