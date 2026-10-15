(() => {
  if (window.__grokBriefExtractorInstalled) return;
  window.__grokBriefExtractorInstalled = true;

  const REMOVE = "script, style, noscript, nav, footer, aside, form, iframe, " +
    "header, [role='navigation'], [role='banner'], [role='complementary'], " +
    ".advertisement, .advert, .ads, .cookie, .newsletter, .social-share";

  function nodeToMarkdown(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(REMOVE).forEach((element) => element.remove());
    clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
      heading.replaceWith(`\n\n${"#".repeat(Number(heading.tagName.slice(1)))} ${heading.innerText}\n\n`);
    });
    clone.querySelectorAll("pre").forEach((code) => {
      code.replaceWith(`\n\n\`\`\`\n${code.innerText}\n\`\`\`\n\n`);
    });
    clone.querySelectorAll("li").forEach((item) => item.replaceWith(`\n- ${item.innerText}\n`));
    clone.querySelectorAll("p, tr").forEach((item) => item.insertAdjacentText("afterend", "\n\n"));
    return clone.innerText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function extract() {
    const candidates = [...document.querySelectorAll("article, main, [role='main'], .post, .entry-content, .article-body")];
    const root = candidates.sort((a, b) => b.innerText.length - a.innerText.length)[0] || document.body;
    const text = nodeToMarkdown(root);
    const title = document.querySelector("h1")?.innerText?.trim() || document.title.trim();
    return {
      title: title || "Untitled article",
      url: location.href,
      website: location.hostname,
      text: text.slice(0, 120000),
      originalLength: text.length,
      wordCount: text ? text.split(/\s+/).length : 0
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "EXTRACT_ARTICLE") return;
    const article = extract();
    if (article.text.length < 400) {
      sendResponse({ error: "This page does not contain enough readable article content." });
    } else {
      sendResponse({ article });
    }
  });
})();
