function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function markdownToSafeHtml(markdown: string): string {
  const lines = markdown.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return "";
  }

  const unordered = lines.every((line) => /^[-*]\s+/.test(line));
  const ordered = lines.every((line) => /^\d+[.)]\s+/.test(line));

  if (unordered || ordered) {
    const items = lines
      .map((line) => line.replace(/^([-*]|\d+[.)])\s+/, ""))
      .map((line) => `<li>${inlineMarkdown(line)}</li>`)
      .join("");
    return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
  }

  return lines.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("");
}

export function definitionsToMarkdown(definitions: string[]): string {
  const cleanDefinitions = definitions.map((definition) => definition.trim()).filter(Boolean);
  if (cleanDefinitions.length === 0) {
    return "";
  }
  if (cleanDefinitions.length === 1) {
    return cleanDefinitions[0];
  }
  return cleanDefinitions.map((definition) => `- ${definition}`).join("\n");
}
