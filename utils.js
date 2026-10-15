export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

export function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let ordered = false;
  let code = [];
  let inCode = false;

  const inline = (value) => escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const tag = ordered ? "ol" : "ul";
    html.push(`<${tag}>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`);
    list = [];
  };
  const flushCode = () => {
    if (code.length) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    code = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      else {
        flushParagraph();
        flushList();
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }

    const tableSeparator = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(lines[index + 1] || "");
    if (line.includes("|") && tableSeparator) {
      flushParagraph();
      flushList();
      const cells = (value) => value.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const header = cells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(`<div class="table-wrap"><table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${inline(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    const heading = line.match(/^\s*(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(4, heading[1].length + 1);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      if (list.length && ordered !== Boolean(numbered)) flushList();
      ordered = Boolean(numbered);
      list.push((bullet || numbered)[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  if (inCode) flushCode();
  flushParagraph();
  flushList();
  return html.join("");
}

export function readingTime(words) {
  return Math.max(1, Math.ceil(words / 220));
}

export function downloadText(filename, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
