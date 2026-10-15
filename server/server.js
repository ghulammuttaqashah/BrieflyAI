import "dotenv/config";
import express from "express";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.EXTENSION_ORIGIN || "*";
const defaultModel = "openai/gpt-oss-120b";
const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
const groqModelsUrl = "https://api.groq.com/openai/v1/models";
const maxRequestCharacters = 30000;
let modelsCache = { at: 0, data: null };

app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

function getMaxTokens(summaryLength) {
  if (summaryLength === "short") return 700;
  if (summaryLength === "long") return 1800;
  return 1100;
}

function getRetryDelay(error, attempt) {
  const retryAfter = Number(error?.retryAfter);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 10000);
  const waitMatch = String(error?.message || "").match(/try again in ([\d.]+)(ms|s)/i);
  if (waitMatch) {
    const wait = Number(waitMatch[1]) * (waitMatch[2].toLowerCase() === "s" ? 1000 : 1);
    return Math.min(wait, 10000);
  }
  return Math.min(500 * (attempt + 1), 5000);
}

async function createCompletion({ model, messages, maxTokens }) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const upstream = await fetch(groqUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connection": "close",
          Authorization: "Bearer " + process.env.GROQ_API_KEY
        },
        body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(90000)
      });
      const payload = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        const error = new Error(payload?.error?.message || `Groq request failed (${upstream.status}).`);
        error.status = upstream.status;
        error.retryAfter = Number(upstream.headers.get("retry-after"));
        error.providerError = payload?.error;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status);
      const retryable = !status || status === 408 || status === 429 || status >= 500;
      if (!retryable || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, getRetryDelay(error, attempt)));
    }
  }
  throw lastError;
}

async function fetchModels() {
  const now = Date.now();
  if (modelsCache.data && now - modelsCache.at < 10 * 60 * 1000) return modelsCache.data;

  const upstream = await fetch(groqModelsUrl, {
    headers: {
      Authorization: "Bearer " + process.env.GROQ_API_KEY
    },
    signal: AbortSignal.timeout(30000)
  });
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const error = new Error(payload?.error?.message || `Groq model list failed (${upstream.status}).`);
    error.status = upstream.status;
    error.retryAfter = Number(upstream.headers.get("retry-after"));
    throw error;
  }

  const models = Array.isArray(payload?.data)
    ? payload.data
        .map((item) => ({
          id: typeof item?.id === "string" ? item.id : "",
          ownedBy: typeof item?.owned_by === "string" ? item.owned_by : "",
          contextWindow: item?.context_window ?? null,
          maxCompletionTokens: item?.max_completion_tokens ?? null
        }))
        .filter((item) => item.id)
        .sort((left, right) => left.id.localeCompare(right.id))
    : [];

  modelsCache = { at: now, data: models };
  return models;
}

app.post("/api/grok", async (request, response) => {
  const { model, messages, summaryLength } = request.body || {};
  if (!process.env.GROQ_API_KEY) {
    return response.status(503).json({ error: "Groq server API key is not configured." });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
    return response.status(400).json({ error: "A valid message list is required." });
  }
  const requestCharacters = messages.reduce((total, message) => (
    total + (typeof message?.content === "string" ? message.content.length : 0)
  ), 0);
  if (requestCharacters > maxRequestCharacters) {
    return response.status(413).json({
      error: "The article context is too large for this model. Shorten the article or ask a more focused question.",
      requestCharacters,
      maxRequestCharacters
    });
  }

  try {
    const completion = await createCompletion({
      model: typeof model === "string" && model.length <= 100 ? model : defaultModel,
      messages,
      maxTokens: getMaxTokens(summaryLength)
    });
    return response.json(completion);
  } catch (error) {
    const status = Number(error?.status) || 502;
    const cause = error?.cause?.code || error?.cause?.message;
    let message = error?.message || "Groq request failed.";
    if (status === 429) {
      const retryAfter = Number(error?.retryAfter);
      const waitMessage = Number.isFinite(retryAfter) && retryAfter > 0
        ? `Try again in about ${Math.ceil(retryAfter)} seconds.`
        : "Wait a moment and try again.";
      message = `Groq is rate-limiting this model because the request used too many tokens. ${waitMessage}`;
    } else if (status === 401 || status === 403) {
      message = "Groq rejected the server credentials. Check GROQ_API_KEY and its model access.";
    } else if (status === 408 || status >= 500) {
      message = "Groq is temporarily unavailable or the request timed out. Please try again.";
    }
    const detail = cause ? `${message} (${cause})` : message;
    console.error("Groq request failed:", detail);
    const retryAfter = Number(error?.retryAfter);
    return response.status(status >= 400 && status < 600 ? status : 502).json({
      error: detail,
      upstreamStatus: error?.status || null,
      retryAfter: Number.isFinite(retryAfter) ? retryAfter : null
    });
  }
});

app.get("/api/models", async (_request, response) => {
  if (!process.env.GROQ_API_KEY) {
    return response.status(503).json({ error: "Groq server API key is not configured." });
  }
  try {
    const models = await fetchModels();
    return response.json({ data: models });
  } catch (error) {
    const status = Number(error?.status) || 502;
    const message = error?.message || "Groq model list failed.";
    console.error("Groq model list failed:", message);
    return response.status(status >= 400 && status < 600 ? status : 502).json({
      error: message,
      upstreamStatus: error?.status || null
    });
  }
});

app.get("/api/grok", (_request, response) => {
  response.status(405).json({
    error: "Use POST /api/grok with JSON fields: model, messages, and summaryLength."
  });
});
app.get("/health", (_request, response) => {
  response.json({ ok: true, groqKeyConfigured: Boolean(process.env.GROQ_API_KEY) });
});

const server = app.listen(port, () => {
  console.log(`BrieflyAI proxy listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`BrieflyAI proxy port ${port} is already in use. Check: curl http://localhost:${port}/health`);
  } else {
    console.error("Unable to start BrieflyAI proxy:", error.message);
  }
  process.exitCode = 1;
});
