import { applyTheme, getSettings, watchSettings } from "./storage.js";
import { escapeHtml } from "./utils.js";
const $ = (selector) => document.querySelector(selector);
let article;
function status(message, error = false) { $("#status").textContent = message; $("#status").classList.toggle("error", error); }
async function extractArticle() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a public HTTP(S) article page first.");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-extractor.js"] });
  const result = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ARTICLE" });
  if (result?.error) throw new Error(result.error);
  article = result.article;
  $("#articleCard").innerHTML = `<strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.website)} · ${article.wordCount.toLocaleString()} words · ~${Math.max(1, Math.ceil(article.wordCount / 220))} min read</span>`;
}
async function init() {
  try {
    const settings = await getSettings();
    applyTheme(settings.theme);
    await extractArticle();
    $("#mode").value = settings.defaultMode;
  } catch (error) {
    $("#articleStatus").textContent = error.message;
  }
}
watchSettings((changedSettings) => {
  if (changedSettings.defaultMode) $("#mode").value = changedSettings.defaultMode;
});
$("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#saved").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("saved.html") }));
$("#summarize").addEventListener("click", async () => {
  if (!article) return status("No article is ready to summarize.", true);
  await chrome.storage.session.set({ article, mode: $("#mode").value, autoSummarize: true });
  status("Opening the full summary...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});
init();
