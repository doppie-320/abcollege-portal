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

export type BodyImage = { src: string; alt: string };

// Tiles shown in a gallery; the rest sit behind a "+N" on the last tile and are reached in the lightbox.
const GALLERY_TILES = 4;

// Run on sanitized HTML. Gives each image a data-lightbox-index into the returned `images`
// (so clicking it can open the viewer), and lays out back-to-back images as one gallery:
// 2 side by side, 3 as one big plus two stacked, 4 or more as a 2x2 grid.
export function layoutBodyImages(html: string): { html: string; images: BodyImage[] } {
  if (typeof window === "undefined" || !html) return { html, images: [] };
  const root = new DOMParser().parseFromString(html, "text/html").body;
  const images: BodyImage[] = [];

  root.querySelectorAll("img").forEach((img) => {
    // A linked image keeps acting as the link.
    if (img.closest("a")) return;
    img.setAttribute("data-lightbox-index", String(images.length));
    images.push({ src: img.getAttribute("src") ?? "", alt: img.getAttribute("alt") ?? "" });
  });

  const isViewable = (node: Node | null): node is HTMLImageElement =>
    node instanceof HTMLImageElement && node.hasAttribute("data-lightbox-index");
  // Whitespace or an empty paragraph left between uploads doesn't break up a run of images.
  const isBlank = (node: Node) =>
    node.nodeType === Node.TEXT_NODE
      ? !node.textContent?.trim()
      : node.nodeName === "P" && !node.textContent?.trim() && !(node as Element).querySelector("img, video");

  const runs: HTMLImageElement[][] = [];
  let run: HTMLImageElement[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (isViewable(node)) run.push(node);
    else if (!(run.length && isBlank(node))) {
      if (run.length) runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  for (const group of runs) {
    if (group.length < 2) continue;

    const last = group[group.length - 1];
    for (let node = group[0].nextSibling; node && node !== last; ) {
      const next = node.nextSibling;
      if (!isViewable(node)) node.remove();
      node = next;
    }

    const gallery = root.ownerDocument.createElement("div");
    gallery.className = `imageGallery count${Math.min(group.length, GALLERY_TILES)}`;
    group[0].before(gallery);

    group.forEach((img, i) => {
      if (i >= GALLERY_TILES) {
        img.remove();
        return;
      }
      const hidden = group.length - GALLERY_TILES;
      const tile = root.ownerDocument.createElement("span");
      tile.className = "galleryTile";
      tile.setAttribute("data-lightbox-index", img.getAttribute("data-lightbox-index")!);
      tile.setAttribute("role", "button");
      tile.setAttribute("tabindex", "0");
      tile.setAttribute(
        "aria-label",
        `View image ${i + 1} of ${group.length}` + (i === GALLERY_TILES - 1 && hidden > 0 ? `, ${hidden} more` : "")
      );
      if (i === GALLERY_TILES - 1 && hidden > 0) tile.setAttribute("data-more", `+${hidden}`);
      img.removeAttribute("data-lightbox-index");
      tile.append(img);
      gallery.append(tile);
    });
  }

  // Images not in a gallery are their own button.
  root.querySelectorAll("img[data-lightbox-index]").forEach((img) => {
    img.setAttribute("role", "button");
    img.setAttribute("tabindex", "0");
    if (!img.getAttribute("alt")) img.setAttribute("aria-label", "View image");
  });

  return { html: root.innerHTML, images };
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
