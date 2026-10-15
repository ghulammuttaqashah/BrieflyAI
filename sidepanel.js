import { applyTheme, getSettings, saveSummary, watchSettings } from "./storage.js";
import { summarizeArticle, askArticle } from "./summarizer.js";
import { markdownToHtml, readingTime, escapeHtml } from "./utils.js";
let article; let summary = ""; let history = []; let summaryInProgress = false;
const $ = (s) => document.querySelector(s);
function progress(text, error = false) { $("#progress").textContent = text; $("#progress").classList.toggle("error", error); }
function toast(message, error = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast visible${error ? " error" : ""}`;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("visible"), 2600);
}
function setSummaryLoading(loading) {
  $("#summary").classList.toggle("loading", loading);
  if (loading) {
    $("#summary").innerHTML = '<div class="skeleton-line wide"></div><div class="skeleton-line"></div><div class="skeleton-line medium"></div><div class="skeleton-block"></div>';
  }
}
function scrollChat() {
  const chat = $("#chat");
  chat.scrollTop = chat.scrollHeight;
}
function renderArticle() { $("#articleInfo").innerHTML = `<h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.website)} · ${article.wordCount.toLocaleString()} words · ${readingTime(article.wordCount)} min full read</p>`; }
const MODE_HINTS = {
  quick: "A focused overview for a fast read.",
  detailed: "A section-by-section explanation of the article.",
  takeaways: "The most useful insights and actions.",
  beginner: "Plain-language explanations with key terms.",
  technical: "Technical concepts, implementation details, and code from the article.",
  steps: "An ordered guide using only instructions in the article."
};
function updateModeHint() { $("#modeHint").textContent = MODE_HINTS[$("#mode").value] || ""; }
async function summarize() {
  if (summaryInProgress || !article) return;
  summaryInProgress = true;
  const button = $("#summarize");
  button.disabled = true;
  $("#mode").disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = '<span class="spinner"></span>Summarizing';
  setSummaryLoading(true);
  try {
    const settings = await getSettings();
    summary = await summarizeArticle(article, $("#mode").value, settings, progress);
    $("#summary").innerHTML = markdownToHtml(summary);
    $("#summary").classList.remove("empty", "loading");
    progress("Summary ready.");
    toast("Summary is ready.");
  } catch (error) {
    setSummaryLoading(false);
    $("#summary").innerHTML = "The summary could not be generated. Try again.";
    $("#summary").classList.add("empty");
    progress(error.message, true);
    toast(error.message, true);
  } finally {
    button.disabled = false;
    $("#mode").disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = "Summarize";
    summaryInProgress = false;
  }
}
async function init() {
  const data = await chrome.storage.session.get(["article", "mode", "autoSummarize"]);
  article = data.article;
  if (!article) return progress("No article loaded. Close this panel and start from the extension button.", true);
  $("#mode").value = data.mode || "quick"; updateModeHint(); renderArticle();
  const settings = await getSettings();
  applyTheme(settings.theme);
  if (data.autoSummarize) {
    await chrome.storage.session.set({ autoSummarize: false });
    // Give Chrome time to finish attaching the side panel before its first
    // large network request. Manual summaries remain immediate.
    window.setTimeout(() => summarize(), 700);
  }
}
watchSettings((changedSettings) => {
  if (changedSettings.defaultMode && !summaryInProgress) {
    $("#mode").value = changedSettings.defaultMode;
    updateModeHint();
  }
});
$("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#mode").addEventListener("change", updateModeHint);
$("#summarize").addEventListener("click", summarize);
$("#copy").addEventListener("click", async () => {
  if (!summary) return toast("Summarize the article first.", true);
  try {
    await navigator.clipboard.writeText(summary);
    toast("Summary copied to clipboard.");
    progress("Summary copied.");
  } catch (error) {
    toast("Could not copy the summary.", true);
    progress(error.message, true);
  }
});
$("#save").addEventListener("click", async () => {
  if (!summary) return toast("Summarize the article first.", true);
  const button = $("#save");
  button.disabled = true;
  button.classList.add("is-loading");
  try {
    await saveSummary({ title: article.title, url: article.url, website: article.website, mode: $("#mode").value, content: summary });
    toast("Summary saved locally.");
    progress("Saved locally.");
  } catch (error) {
    toast("Could not save the summary.", true);
    progress(error.message, true);
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
  }
});
$("#original").addEventListener("click", () => {
  chrome.tabs.create({ url: article.url });
  toast("Opening the original article.");
});
$("#questionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#question");
  const question = input.value.trim();
  if (!question || !article) return;
  input.value = "";
  $("#chat").insertAdjacentHTML("beforeend", `<div class="chat-message user"><div class="chat-avatar">You</div><div class="chat-bubble"><small>You</small><div>${escapeHtml(question)}</div></div></div>`);
  $("#chat .chat-empty")?.remove();
  $("#chat").insertAdjacentHTML("beforeend", '<div id="typing" class="chat-message assistant typing-message"><div class="chat-avatar">B</div><div class="chat-bubble"><small>BrieflyAI</small><div class="typing-dots"><i></i><i></i><i></i></div></div></div>');
  $("#questionForm button").disabled = true;
  input.disabled = true;
  scrollChat();
  try {
    const answer = await askArticle(question, article, history, await getSettings());
    history.push({ role: "user", content: question }, { role: "assistant", content: answer });
    $("#typing")?.remove();
    $("#chat").insertAdjacentHTML("beforeend", `<div class="chat-message assistant"><div class="chat-avatar">B</div><div class="chat-bubble"><small>BrieflyAI</small><div>${markdownToHtml(answer)}</div></div></div>`);
    scrollChat();
  } catch (error) {
    $("#typing")?.remove();
    progress(error.message, true);
    toast("Could not get a reply.", true);
  } finally {
    $("#questionForm button").disabled = false;
    input.disabled = false;
    input.focus();
  }
});
init();
