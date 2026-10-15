export const DEFAULTS = {
  model: "openai/gpt-oss-120b",
  summaryLength: "medium",
  language: "English",
  style: "clear",
  defaultMode: "quick",
  theme: "system"
};

export const MODES = {
  quick: "Quick Summary",
  detailed: "Detailed Summary",
  takeaways: "Key Takeaways",
  beginner: "Beginner Mode",
  technical: "Technical Mode",
  steps: "Step-by-Step Guide"
};

export function applyTheme(theme = DEFAULTS.theme) {
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  const isLight = theme === "light" || (theme === "system" && prefersLight);
  document.documentElement.dataset.theme = isLight ? "light" : "dark";
  document.documentElement.style.colorScheme = isLight ? "light" : "dark";
}

export function watchSettings(onChange) {
  const handleStorageChange = (changes, areaName) => {
    if (areaName !== "local") return;
    const changedSettings = Object.fromEntries(
      Object.entries(changes).map(([key, change]) => [key, change.newValue])
    );
    if (Object.hasOwn(changedSettings, "theme")) applyTheme(changedSettings.theme);
    onChange?.(changedSettings);
  };

  chrome.storage.onChanged.addListener(handleStorageChange);

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: light)");
  const handleSystemThemeChange = () => {
    getSettings().then(({ theme }) => applyTheme(theme));
  };
  mediaQuery?.addEventListener?.("change", handleSystemThemeChange);

  return () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
    mediaQuery?.removeEventListener?.("change", handleSystemThemeChange);
  };
}

export async function getSettings() {
  const settings = await chrome.storage.local.get(DEFAULTS);
  if (
    settings.model === "openai/gpt-oss-20b"
    || settings.model === "llama-3.3-70b-versatile"
    || settings.model === "qwen/qwen3.8-27b"
    || settings.model === "minimaxai/minimax-m2.7"
    || settings.model === "grok-4-fast-non-reasoning"
    || settings.model === "grok-3-mini"
  ) {
    settings.model = DEFAULTS.model;
    await chrome.storage.local.set({ model: DEFAULTS.model });
  }
  return settings;
}

export async function saveSummary(summary) {
  const { savedSummaries = [] } = await chrome.storage.local.get({ savedSummaries: [] });
  const entry = { ...summary, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
  await chrome.storage.local.set({ savedSummaries: [entry, ...savedSummaries].slice(0, 100) });
  return entry;
}

export async function getSavedSummaries() {
  const { savedSummaries = [] } = await chrome.storage.local.get({ savedSummaries: [] });
  return savedSummaries;
}

export async function deleteSummary(id) {
  const summaries = await getSavedSummaries();
  await chrome.storage.local.set({ savedSummaries: summaries.filter((summary) => summary.id !== id) });
}
