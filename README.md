# BrieflyAI — Read Less, Understand More

BrieflyAI is a lightweight Chrome Manifest V3 extension that extracts readable article content and analyzes it with an AI API.

## Install and configure

1. Create a Groq API key from the Groq console and keep it on the proxy server only.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this folder.
3. Start the proxy (see below), choose a model in BrieflyAI settings, and save.
4. Open an article, click the extension, choose a mode, and click **Summarize Article**.

The default model is `openai/gpt-oss-120b`; change it in Settings if your Groq account uses another model returned by `https://api.groq.com/openai/v1/models`.

## Start the secure proxy

```bash
cd server
npm install
cp .env.example .env
# Edit .env and set GROQ_API_KEY to your Groq key.
npm start
```

The proxy uses the official `groq-sdk` package and calls `groq.chat.completions.create()`. If `npm install` fails with `ETIMEDOUT`, fix npm/network access and run it again; do not install `grok-sdk`, which is a different package.

The extension calls `http://localhost:8787/api/grok`; the key never enters the extension.

## Features

- On-demand extraction of headings, paragraphs, lists, tables, and code blocks.
- Six modes: Quick, Detailed, Key Takeaways, Beginner, Technical, and Step-by-Step.
- Long-content chunking and a final merge pass.
- Structured, source-faithful Markdown with facts, claims, takeaways, terms, conclusion, learning outcomes, and a full-reading recommendation.
- Ask This Article with follow-up context and an explicit unavailable-information response.
- Local saved summaries with search, copy, Markdown export, and delete.
- Local settings for model, length, language, style, default mode, and theme.

## Privacy and costs

Extraction starts only after the user clicks the extension action. The extension does not collect browsing history or credentials. Article text is sent through the BrieflyAI proxy to Groq for the requested analysis; API usage may incur Groq charges. Saved summaries and settings use Chrome local storage. The API key is stored only as a server environment variable and is never hardcoded in the extension, placed in a URL, or logged.

## Troubleshooting

- **No content:** use a normal `http`/`https` page; browser-internal pages, extension stores, and some paywalled pages block extraction.
- **401:** verify the key and its account permissions.
- **Proxy not running:** keep `npm start` running in the `server` directory and verify `curl http://localhost:8787/health`.
- **400 from Groq:** open Settings and select a model available to your Groq account; the proxy returns the upstream error body.
- **429/402:** wait for rate limits or add Groq credits.
- **Network error:** check connectivity and the Groq service, then retry.
- **Long article:** extraction is capped at 120,000 characters; content beyond that cap is not sent.

## Testing checklist

Load the folder unpacked, test a public article in each mode, ask a question and follow-up, save/copy/export/delete a result, search saved items, change settings and language, and test an unsupported page and invalid key. JavaScript syntax and manifest JSON can be checked with `node --check <file>` and `python3 -m json.tool manifest.json`.
