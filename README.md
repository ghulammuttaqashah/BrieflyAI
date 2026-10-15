# BrieflyAI

**Read less. Understand more.**

BrieflyAI is a Chrome Manifest V3 extension that extracts readable content from the current web page, sends it through a local proxy to Groq, and presents an organized summary in a responsive side panel. It also provides article-aware chat, saved summaries, model selection, and synchronized light/dark themes.

> The extension is designed for public web articles. Browser-internal pages, extension pages, and some paywalled pages cannot be read by the browser content script.

## What BrieflyAI does

1. Extracts the article currently open in the active tab.
2. Opens the BrieflyAI side panel.
3. Sends article content to the local BrieflyAI proxy.
4. Uses the selected Groq model to generate a structured response.
5. Lets you copy, save, open, and discuss the result.

The Groq API key stays on the local server. It is never placed in the extension source code or sent directly from the browser to Groq.

## Main features

### Article extraction

The content extractor focuses on the readable part of a page and preserves useful structure, including:

- Article title and website
- Headings and paragraphs
- Ordered and unordered lists
- Tables
- Code blocks
- Approximate word count and reading time

Extraction is on demand. BrieflyAI does not automatically scan every page or collect browsing history.

### Six summary modes

Choose a mode from the popup or side panel:

- **Quick Summary** — short overview, key points, and conclusion.
- **Detailed Summary** — follows the article’s major sections and progression.
- **Key Takeaways** — focuses on practical insights and actions.
- **Beginner Mode** — explains concepts in plain language and defines technical terms.
- **Technical Mode** — emphasizes APIs, tools, constraints, trade-offs, implementation details, and article-provided code.
- **Step-by-Step Guide** — converts article instructions into an ordered guide without inventing steps.

The selected mode changes the prompt structure and the expected Markdown format.

### Article-aware chat

The **Ask This Article** panel supports questions and follow-ups using the current article as context.

- User messages appear on the right.
- BrieflyAI replies appear on the left.
- Previous turns are kept for conversational continuity.
- Short requests such as “article in one line” produce a one-sentence summary.
- Missing details may be presented as clearly labeled contextual inferences.
- The assistant is instructed not to reproduce the full article.
- Large article contexts are compacted before chat requests to reduce token-limit errors.

### Saved summaries

Summaries can be saved locally and managed from the Saved Summaries page:

- Search saved summaries
- Copy summary text
- Export Markdown
- Delete saved entries

Saved content is stored in Chrome local storage on the current browser profile.

### Appearance and responsive UI

- Dark, light, and system theme modes
- Theme changes propagate to open extension pages
- Responsive popup and side panel layouts
- Loading skeletons and chat typing indicators
- Toast feedback for copy, save, and error actions
- Accessible labels and visible keyboard focus states
- Custom BrieflyAI icon from `icons.png`

## Project structure

| Path | Purpose |
| --- | --- |
| `manifest.json` | Chrome extension metadata, permissions, icons, popup, side panel, and options page |
| `popup.html/js/css` | Compact entry point for extracting the active article and opening the side panel |
| `sidepanel.html/js/css` | Summary display, action buttons, article chat, loading states, and responsive UI |
| `options.html/js/css` | Model, summary, language, style, default mode, and theme settings |
| `saved.html/js/css` | Local saved-summary search, copy, export, and delete UI |
| `content-extractor.js` | Reads structured readable content from the active page |
| `summarizer.js` | Mode-specific prompts, article chunking, final merge, and chat context |
| `api.js` | Browser-to-proxy request helper and response validation |
| `storage.js` | Defaults, settings synchronization, theme handling, and saved-summary storage |
| `utils.js` | Markdown rendering, HTML escaping, reading-time helpers, and downloads |
| `server/server.js` | Local Express proxy for Groq completions and available-model discovery |
| `server/.env` | Local-only server configuration; never commit this file |
| `icons.png` | BrieflyAI extension icon |

## Requirements

- Google Chrome with Manifest V3 support
- Node.js 18 or newer
- A Groq account and API key
- Network access to `api.groq.com`

## Installation

### 1. Configure the proxy

From the repository root:

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

```env
GROQ_API_KEY=your_groq_api_key
PORT=8787
```

Do not commit `.env` or share the API key.

### 2. Start the proxy

Production-style start:

```bash
cd server
npm start
```

Development mode with automatic restart:

```bash
cd server
npm run dev
```

Check that the server can see the key:

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{"ok":true,"groqKeyConfigured":true}
```

### 3. Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository root, not the `server` folder.
5. Open a public article.
6. Click BrieflyAI.

## Model selection

Open BrieflyAI Settings to choose a model. The model dropdown is populated through:

```text
GET http://localhost:8787/api/models
```

The proxy requests the available model list from:

```text
https://api.groq.com/openai/v1/models
```

The API key is used only by the proxy. The model list is cached by the proxy for ten minutes.

The default model is:

```text
openai/gpt-oss-120b
```

Choose a model available to your Groq account. A model appearing in public documentation may still be unavailable for a particular account or service tier.

## Local proxy API

### Health check

```http
GET /health
```

Returns whether the proxy is running and whether `GROQ_API_KEY` is loaded.

### Available models

```http
GET /api/models
```

Returns model IDs and available metadata such as owner, context window, and maximum completion tokens.

### Chat completion proxy

```http
POST /api/grok
Content-Type: application/json
```

Request fields:

```json
{
  "model": "openai/gpt-oss-120b",
  "summaryLength": "medium",
  "messages": [
    {"role": "system", "content": "System instructions"},
    {"role": "user", "content": "Article content and question"}
  ]
}
```

The proxy:

- Validates the message list.
- Limits oversized requests.
- Forwards the request to Groq.
- Retries temporary failures and rate limits.
- Uses upstream retry timing when provided.
- Returns clearer messages for authentication, timeout, rate-limit, and server errors.

## Troubleshooting

### `GROQ_API_KEY is not configured`

The server could not load the key from `server/.env`.

Check:

```bash
cd server
grep '^GROQ_API_KEY=' .env
curl http://localhost:8787/health
```

The health response should contain:

```json
{"groqKeyConfigured":true}
```

Restart the server after editing `.env`.

### Port 8787 is already in use

Only one proxy process may listen on port 8787.

Check the owner:

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

Stop the specific process:

```bash
kill <PID>
```

Then start either `npm start` or `npm run dev`, not both.

### `Cannot GET /api/models`

Restart the proxy after updating the server code:

```bash
cd server
npm run dev
```

Then test:

```bash
curl http://localhost:8787/api/models
```

### Model does not exist or access is denied

Open Settings and select a model returned by `/api/models`. Your Groq account, organization, plan, or service tier may not have access to every listed model.

### Rate limit or request-too-large errors

Possible causes include:

- Article input is too large.
- Too many requests were made in a short period.
- The selected model has a lower token limit.
- Several chat turns were included in the request.

BrieflyAI reduces chat context and returns a readable error. Try a shorter question, use a shorter summary mode, wait briefly, or select a model with a larger context window.

### No article content

Use a normal `http` or `https` article page. Some pages prevent script access, require a login, use heavy client-side rendering, or expose only a paywall preview.

### Changes are not visible

After changing extension files:

1. Open `chrome://extensions`.
2. Click **Reload** for BrieflyAI.
3. Close and reopen the popup or side panel.

After changing `server/server.js`, restart the proxy unless using `npm run dev`.

## Privacy and security

- The extension does not collect browsing history.
- Article extraction starts only after user interaction.
- The Groq API key remains on the local server.
- The key is not embedded in extension files, URLs, or browser storage.
- Settings and saved summaries use Chrome local storage.
- Article text is sent to Groq through the local proxy for the requested analysis.
- Groq processing and API usage may be subject to Groq’s policies and billing.
- Do not commit `server/.env`.
- If a key is exposed, revoke it immediately and create a replacement.

## Development and validation

Check JavaScript syntax:

```bash
node --check api.js
node --check content-extractor.js
node --check options.js
node --check popup.js
node --check saved.js
node --check sidepanel.js
node --check storage.js
node --check summarizer.js
node --check server/server.js
```

Validate the manifest:

```bash
python3 -m json.tool manifest.json
```

Manual test checklist:

- Load the extension unpacked.
- Extract a public article.
- Test all six summary modes.
- Test copy, save, open original, and toast feedback.
- Ask a question and a follow-up question.
- Test a one-line summary request.
- Open Settings and load the model dropdown.
- Change model, language, style, summary length, default mode, and theme.
- Confirm theme changes in open extension pages.
- Search, copy, export, and delete saved summaries.
- Test an unsupported page, missing key, unavailable model, and stopped proxy.
