import { Node, mergeAttributes } from "@tiptap/react";
import { formatFileSize } from "./uploadMedia";

// <video controls src="..."> block for uploaded or linked videos.
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { src: { default: null } };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "true", preload: "metadata" })];
  },
});

// Downloadable file card: <a data-file-attachment href=... data-name=... data-size=...>.
export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: null },
      name: { default: "file", parseHTML: (el) => el.getAttribute("data-name") },
      size: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-size")) || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-file-attachment]" }];
  },

  renderHTML({ node }) {
    const { href, name, size } = node.attrs as { href: string; name: string; size: number | null };
    const ext = name.includes(".") ? name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE";
    return [
      "a",
      {
        href,
        "data-file-attachment": "",
        "data-name": name,
        "data-size": size ?? "",
        class: "fileAttachment",
        target: "_blank",
        rel: "noopener noreferrer",
      },
      ["span", { class: "fileExt" }, ext],
      [
        "span",
        { class: "fileMeta" },
        ["span", { class: "fileName" }, name],
        ["span", { class: "fileSize" }, size ? `${formatFileSize(size)} · Download` : "Download"],
      ],
    ];
  },
});
