import { applyTheme, DEFAULTS, getSettings, watchSettings } from "./storage.js";

const fields = ["model", "summaryLength", "language", "style", "defaultMode", "theme"];
const form = document.querySelector("#settingsForm");
const status = document.querySelector("#status");
const modelSelect = document.querySelector("#model");

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function optionLabel(model) {
  return model.id;
}

function appendModelOption(model, selected = false) {
  const option = document.createElement("option");
  option.value = model.id;
  option.textContent = optionLabel(model);
  option.selected = selected;
  modelSelect.appendChild(option);
}

async function loadModels(selectedModel) {
  modelSelect.disabled = true;
  modelSelect.innerHTML = "";
  appendModelOption({ id: "Loading models..." }, true);

  try {
    const response = await fetch("http://localhost:8787/api/models");
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `Unable to load Groq models (${response.status}).`);

    const models = Array.isArray(payload?.data) ? payload.data : [];
    modelSelect.innerHTML = "";
    if (!models.length) {
      appendModelOption({ id: selectedModel || DEFAULTS.model }, true);
      setStatus("No models were returned by the server.", true);
      modelSelect.disabled = false;
      return;
    }

    const availableIds = new Set(models.map((model) => model.id));
    for (const model of models) appendModelOption(model, false);
    if (selectedModel && !availableIds.has(selectedModel)) {
      appendModelOption({ id: selectedModel }, true);
    } else {
      modelSelect.value = selectedModel || DEFAULTS.model;
    }
    modelSelect.disabled = false;
    setStatus(`Loaded ${models.length} available Groq models.`);
  } catch (error) {
    modelSelect.innerHTML = "";
    appendModelOption({ id: selectedModel || DEFAULTS.model }, true);
    modelSelect.disabled = false;
    setStatus(error.message || "Could not load available Groq models.", true);
  }
}

const settings = await getSettings();
applyTheme(settings.theme);

for (const field of fields) {
  if (field === "model") continue;
  document.querySelector(`#${field}`).value = settings[field] ?? DEFAULTS[field];
}

watchSettings((changedSettings) => {
  for (const field of fields) {
    if (Object.hasOwn(changedSettings, field)) {
      const element = document.querySelector(`#${field}`);
      if (field === "model") {
        modelSelect.value = changedSettings[field] ?? DEFAULTS[field];
      } else {
        element.value = changedSettings[field] ?? DEFAULTS[field];
      }
    }
  }
});

document.querySelector("#theme").addEventListener("change", async (event) => {
  const theme = event.target.value;
  applyTheme(theme);
  await chrome.storage.local.set({ theme });
  setStatus("Theme updated across BrieflyAI.");
});

await loadModels(settings.model ?? DEFAULTS.model);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(fields.map((field) => [field, document.querySelector(`#${field}`).value.trim()]));
  await chrome.storage.local.set(values);
  applyTheme(values.theme);
  setStatus("Settings saved locally.");
});
