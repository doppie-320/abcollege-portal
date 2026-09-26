import DOMPurify from "dompurify";

// Announcement bodies are stored as HTML produced by the Tiptap editor.
// Older posts were plain text, so anything that doesn't look like markup
// is still rendered as text.
export function isRichText(content: string): boolean {
  return /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|hr|img|video|a|div)[\s>/]/i.test(content);
}

export function sanitizeRichText(html: string): string {
  // DOMPurify needs a DOM; posts are only rendered after the client fetch.
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["style", "form", "input", "button", "iframe"],
  });
}

// Loads a stored body into the editor; legacy plain text becomes paragraphs.
export function toEditorHtml(content: string): string {
  if (isRichText(content)) return content;
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return content
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function richTextToPlain(content: string): string {
  if (!isRichText(content)) return content;
  return content
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "$& ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
