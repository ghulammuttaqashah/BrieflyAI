import { applyTheme, getSavedSummaries, deleteSummary, getSettings, watchSettings } from "./storage.js";
import { downloadText, escapeHtml } from "./utils.js";
let all = [];
const $ = (s) => document.querySelector(s);
function render() { const query = $("#search").value.toLowerCase(); const matches = all.filter((item) => `${item.title} ${item.content}`.toLowerCase().includes(query)); $("#list").innerHTML = matches.length ? matches.map((item) => `<article class="item"><h2>${escapeHtml(item.title)}</h2><div class="meta">${escapeHtml(item.website)} · ${new Date(item.savedAt).toLocaleString()} · ${escapeHtml(item.mode)}</div><p>${escapeHtml(item.content)}</p><div class="buttons"><button data-copy="${item.id}">Copy</button><button data-export="${item.id}">Export Markdown</button><button data-delete="${item.id}">Delete</button></div></article>`).join("") : "<p>No saved summaries yet.</p>"; }
$("#search").addEventListener("input", render);
$("#list").addEventListener("click", async (event) => { const id = event.target.dataset.copy || event.target.dataset.export || event.target.dataset.delete; const item = all.find((entry) => entry.id === id); if (!item) return; if (event.target.dataset.copy) await navigator.clipboard.writeText(item.content); if (event.target.dataset.export) downloadText(`${item.title.replace(/[^a-z0-9]+/gi, "-")}.md`, `# ${item.title}\n\nSource: ${item.url}\nMode: ${item.mode}\n\n${item.content}`, "text/markdown"); if (event.target.dataset.delete) { await deleteSummary(id); all = await getSavedSummaries(); render(); } });
applyTheme((await getSettings()).theme);
watchSettings();
all = await getSavedSummaries(); render();
