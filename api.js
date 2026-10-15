const PROXY_URL = "http://localhost:8787/api/grok";

export async function grokChat(messages, settings, signal) {
  let response;
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        messages,
        summaryLength: settings.summaryLength
      }),
      signal
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("BrieflyAI proxy is not running. Start it with `cd server && npm start`.");
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Grok proxy returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    const error = new Error(payload?.error || `Grok proxy request failed (${response.status}).`);
    if (response.status === 413) {
      error.message = "This article context is too large for the selected model. Try a shorter question or summarize first.";
    }
    error.status = response.status;
    error.retryAfter = payload?.retryAfter;
    throw error;
  }
  const content = typeof payload?.choices?.[0]?.message?.content === "string"
    ? payload.choices[0].message.content.trim()
    : "";
  if (!content)   throw new Error("Groq returned no usable content.");
  return content;
}
