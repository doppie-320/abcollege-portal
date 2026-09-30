"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import FileHandler from "@tiptap/extension-file-handler";
import Select from "@/components/Select";
import PostContent from "./PostContent";
import ConfirmDialog from "./ConfirmDialog";
import type { Announcement, User } from "@/app/home/HomeContent";
import { createClient } from "@/lib/supabase/client";
import { FileAttachment, Video } from "@/lib/mediaNodes";
import { uploadMedia, type UploadedMedia } from "@/lib/uploadMedia";
import { toEditorHtml } from "@/lib/richText";

export type NewPost = {
  title: string;
  tag: string;
  content: string;
};

type MediaKind = "image" | "video" | "file";
type UrlMode = "link" | MediaKind | null;

function mediaNode(media: UploadedMedia, kind?: MediaKind) {
  const resolved = kind ?? (media.mime.startsWith("image/") ? "image" : media.mime.startsWith("video/") ? "video" : "file");
  if (resolved === "image") return { type: "image", attrs: { src: media.url, alt: media.name } };
  if (resolved === "video") return { type: "video", attrs: { src: media.url } };
  return { type: "fileAttachment", attrs: { href: media.downloadUrl, name: media.name, size: media.size } };
}

export default function CreatePostModal({
  currentUser,
  tags,
  initialPost,
  onClose,
  onSubmit,
}: {
  currentUser: User;
  tags: string[];
  // When set, the modal edits this post instead of creating a new one.
  initialPost?: NewPost & { postedAt: string };
  onClose: () => void;
  onSubmit: (post: NewPost) => Promise<void>;
}) {
  const isEdit = !!initialPost;
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [tag, setTag] = useState(initialPost?.tag ?? tags[0] ?? "");
  const [bodyChanged, setBodyChanged] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(0);
  // Snapshot of the editor body while previewing; null while editing.
  const [preview, setPreview] = useState<{ html: string; at: string } | null>(null);
  const [supabase] = useState(() => createClient());
  const titleRef = useRef<HTMLInputElement>(null);

  // Uploads each file to Storage, then inserts it at `pos` (drop target) or the cursor.
  async function insertFiles(target: Editor, files: File[], kind?: MediaKind, pos?: number) {
    setError("");
    setUploading((n) => n + files.length);
    if (pos !== undefined) target.commands.setTextSelection(pos);
    for (const file of files) {
      try {
        const media = await uploadMedia(supabase, currentUser.id, file);
        target.chain().focus().insertContent(mediaNode(media, kind)).run();
      } catch (err) {
        console.error("Error uploading announcement media:", err);
        setError(err instanceof Error && err.message ? err.message : `Couldn't upload "${file.name}".`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    content: initialPost ? toEditorHtml(initialPost.content) : "",
    onUpdate: () => setBodyChanged(true),
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Image,
      Video,
      FileAttachment,
      FileHandler.configure({
        consumePasteEvent: true,
        onDrop: (target, files, pos) => insertFiles(target, files, undefined, pos),
        onPaste: (target, files) => insertFiles(target, files),
      }),
      Placeholder.configure({ placeholder: "Write your announcement..." }),
      CharacterCount,
    ],
    editorProps: {
      attributes: { class: "richText editorContent", "aria-label": "Announcement body" },
      handleDOMEvents: {
        // Attachment cards are real links; don't navigate away while editing.
        click: (_view, event) => {
          if ((event.target as HTMLElement).closest("a.fileAttachment")) event.preventDefault();
          return false;
        },
      },
    },
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor }) => ({
      words: editor?.storage.characterCount.words() ?? 0,
      isEmpty: editor?.isEmpty ?? true,
    }),
  });

  const isDirty = title !== (initialPost?.title ?? "") || tag !== (initialPost?.tag ?? tags[0] ?? "") || bodyChanged;
  const canPublish =
    title.trim() !== "" && tag !== "" && !(counts?.isEmpty ?? true) && !submitting && uploading === 0;

  // Asks via the discard panel first when there's something to lose.
  function requestClose() {
    if (submitting) return;
    if (isDirty) setShowDiscard(true);
    else onClose();
  }

  useEffect(() => {
    titleRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // While the discard panel is open, Esc belongs to it (it cancels the discard).
      if (e.key !== "Escape" || e.defaultPrevented || submitting || showDiscard) return;
      if (isDirty) setShowDiscard(true);
      else onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDirty, showDiscard, submitting, onClose]);

  function togglePreview() {
    if (preview) {
      setPreview(null);
      editor?.commands.focus();
    } else if (editor) {
      setPreview({ html: editor.getHTML(), at: new Date().toISOString() });
    }
  }

  const previewPost: Announcement | null = preview && {
    id: "preview",
    tag,
    postedAt: initialPost?.postedAt ?? preview.at,
    authorId: currentUser.id,
    title: title.trim() || "Untitled announcement",
    body: preview.html,
    reactedBy: [],
    comments: [],
  };

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!editor || !canPublish) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ title: title.trim(), tag, content: editor.getHTML() });
      onClose();
    } catch {
      setError(isEdit ? "Couldn't save your changes. Please try again." : "Couldn't publish your post. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modalBackdrop" onClick={requestClose}>
      <form
        className="modalPanel"
        onClick={(e) => e.stopPropagation()}
        onSubmit={publish}
        role="dialog"
        aria-modal="true"
        aria-labelledby="createPostHeading"
      >
        <div className="modalTopBar">
          <span className="modalTopBarTitle mono" id="createPostHeading">
            {isEdit ? "EDIT ANNOUNCEMENT" : "NEW ANNOUNCEMENT"}
            {tag ? ` / ${tag.toUpperCase()}` : ""}
          </span>
          <button type="button" className="modalClose" onClick={requestClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modalAccent"></div>

        <div className="modalBody">
          <div className="composeColumn" hidden={!!previewPost}>
            <input
              ref={titleRef}
              type="text"
              className="titleInput"
              placeholder="Announcement title"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Announcement title"
            />

            <div className="editorFrame">
              {editor && (
                <Toolbar editor={editor} onUpload={(files, kind) => insertFiles(editor, files, kind)} />
              )}
              <div className="editorScroll" onClick={() => editor?.chain().focus().run()}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {previewPost && (
            <div className="previewPane">
              <div className="previewInner">
                <span className="previewNote mono">PREVIEW / AS IT WILL APPEAR ON THE BULLETIN BOARD</span>
                <div className="tick-frame previewFrame">
                  <span className="tick-bl"></span>
                  <span className="tick-br"></span>
                  <PostContent
                    announcement={previewPost}
                    currentUser={currentUser}
                    authorOverride={currentUser}
                    collapsible
                    onToggleReaction={() => {}}
                    onCommentClick={() => {}}
                  />
                </div>
              </div>
            </div>
          )}

          <aside className="sidePanel">
            <div className="sideSection">
              <span className="sideLabel mono">Posting as</span>
              <div className="authorRow">
                <span className="avatar">{currentUser.initials}</span>
                <span className="authorName">{currentUser.name}</span>
              </div>
            </div>

            <div className="sideSection tagSection">
              <span className="sideLabel mono">Tag</span>
              <Select
                id="createPostTag"
                value={tag}
                onChange={setTag}
                options={tags}
                placeholder="Choose a tag"
                aria-label="Announcement tag"
                compact
              />
            </div>

            <div className="sideSection">
              <span className="sideLabel mono">Length</span>
              <span className="wordCount mono">
                {counts?.words ?? 0} word{counts?.words === 1 ? "" : "s"}
              </span>
            </div>

            <div className="sideSection tipSection">
              <span className="sideLabel mono">Tip</span>
              <p className="tipText">
                Hover over a toolbar button for 2 seconds to see what it does, its shortcut, and a preview of the
                result.
              </p>
              <p className="tipText">
                Use <strong>Preview</strong> to see the post exactly as it will appear on the bulletin board.
              </p>
            </div>
          </aside>
        </div>

        <div className="modalFooter">
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : uploading > 0 ? (
            <span className="footerHint uploadingHint mono" role="status">
              UPLOADING {uploading} FILE{uploading === 1 ? "" : "S"}...
            </span>
          ) : (
            <span className="footerHint mono">ESC TO CLOSE</span>
          )}
          <div className="footerActions">
            <button type="button" className="btn ghost" onClick={requestClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ghost previewBtn${previewPost ? " active" : ""}`}
              onClick={togglePreview}
              disabled={!editor}
              aria-pressed={!!previewPost}
            >
              {previewPost ? <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /> : <Icon d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />}
              {previewPost ? "Keep editing" : "Preview"}
            </button>
            <button type="submit" className="btn primary publishBtn" disabled={!canPublish}>
              {isEdit ? (submitting ? "Saving..." : "Save changes") : submitting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </form>

      {showDiscard && (
        <ConfirmDialog
          tone="warning"
          title={isEdit ? "Discard your changes?" : "Discard this post?"}
          message={
            isEdit ? (
              <>
                Your edits to <strong>&ldquo;{initialPost?.title}&rdquo;</strong> won&apos;t be saved. The published post
                stays as it is.
              </>
            ) : (
              "Your draft, including its title, formatting and any media you added, will be lost."
            )
          }
          cancelLabel="Keep editing"
          confirmLabel={isEdit ? "Discard changes" : "Discard"}
          onCancel={() => {
            setShowDiscard(false);
            editor?.commands.focus();
          }}
          onConfirm={onClose}
        />
      )}

      <style jsx>{`
        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(13, 30, 56, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 100;
          animation: fadeIn 0.15s ease backwards;
        }

        .modalPanel {
          width: 100%;
          max-width: 1080px;
          height: min(860px, 92vh);
          background: var(--white);
          border-radius: 8px;
          border: 1px solid #c9bfa0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
          animation: popIn 0.2s ease backwards;
        }

        .modalTopBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px 10px 18px;
          background: var(--navy);
          border-bottom: 3px solid var(--orange);
          flex-shrink: 0;
        }

        .modalAccent {
          height: 3px;
          background: var(--yellow);
          flex-shrink: 0;
        }

        .modalTopBarTitle {
          font-size: 11.5px;
          color: #c6d3e5;
          letter-spacing: 0.08em;
        }

        .modalClose {
          background: rgba(255, 255, 255, 0.12);
          border: none;
          padding: 5px;
          border-radius: 4px;
          color: var(--white);
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }

        .modalClose:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .modalClose:focus-visible {
          outline: 2px solid var(--grid);
          outline-offset: 1px;
        }

        .modalBody {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 1fr 260px;
        }

        .composeColumn {
          display: flex;
          flex-direction: column;
          min-height: 0;
          min-width: 0;
          padding: 20px 22px;
          gap: 14px;
        }

        .titleInput {
          margin-bottom: 0 !important;
          border: none !important;
          border-bottom: 1px solid #c9bfa0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 4px 0 10px !important;
          font-family: "Space Grotesk", sans-serif !important;
          font-size: 24px !important;
          font-weight: 600;
          color: var(--navy-deep) !important;
        }

        .titleInput:focus {
          outline: none;
          border-bottom-color: var(--navy) !important;
        }

        .editorFrame {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          overflow: hidden;
          background: var(--white);
        }

        .editorFrame:focus-within {
          border-color: var(--blue);
        }

        .editorScroll {
          flex: 1;
          overflow-y: auto;
          cursor: text;
        }

        .editorScroll :global(.editorContent) {
          min-height: 100%;
          padding: 18px 20px 40px;
          outline: none;
        }

        .editorScroll :global(.editorContent p.is-editor-empty:first-child::before) {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          color: var(--ink-soft);
          opacity: 0.7;
          pointer-events: none;
        }

        .editorScroll :global(.editorContent .ProseMirror-selectednode) {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .editorScroll :global(.editorContent a.fileAttachment) {
          cursor: default;
        }

        .composeColumn[hidden] {
          display: none;
        }

        .previewPane {
          min-height: 0;
          min-width: 0;
          overflow-y: auto;
          padding: 24px 22px;
          background-color: var(--vellum);
          background-image: linear-gradient(var(--vellum-2) 1px, transparent 1px),
            linear-gradient(90deg, var(--vellum-2) 1px, transparent 1px);
          background-size: 32px 32px;
          animation: fadeIn 0.15s ease backwards;
        }

        .previewInner {
          max-width: 720px;
          margin: 0 auto;
        }

        .previewNote {
          display: block;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          color: var(--ink-soft);
          margin-bottom: 10px;
        }

        .previewFrame {
          animation: fadeInUp 0.25s ease backwards;
        }

        .previewFrame :global(.postActions) {
          pointer-events: none;
        }

        .tipSection {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px dashed #c9bfa0;
        }

        .tipText {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
          color: var(--ink-soft);
        }

        .previewBtn {
          gap: 6px;
        }

        .previewBtn.active {
          background: var(--navy);
          color: var(--white);
        }

        .previewBtn.active:hover {
          background: var(--navy-deep);
        }

        .sidePanel {
          border-left: 1px solid #c9bfa0;
          background: var(--vellum);
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
        }

        .sideSection {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tagSection {
          position: relative;
          z-index: 5;
        }

        .sideLabel {
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
        }

        .authorRow {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          font-size: 12px;
          flex-shrink: 0;
        }

        .authorName {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .wordCount {
          font-size: 12px;
          color: var(--ink-soft);
        }

        .modalFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 22px;
          border-top: 1px solid #c9bfa0;
          background: var(--vellum);
          flex-shrink: 0;
        }

        .footerHint {
          font-size: 10.5px;
          letter-spacing: 0.08em;
          color: var(--ink-soft);
        }

        .uploadingHint {
          color: var(--orange);
          animation: pulse 1.2s ease-in-out infinite;
        }

        @keyframes pulse {
          50% {
            opacity: 0.45;
          }
        }

        .formError {
          margin: 0;
          font-size: 12.5px;
          color: #b3261e;
        }

        .footerActions {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .footerActions .btn {
          padding: 8px 18px;
          font-size: 13.5px;
        }

        @media (max-width: 820px) {
          .modalBackdrop {
            padding: 0;
          }

          .modalPanel {
            height: 100%;
            max-height: none;
            border-radius: 0;
            border: none;
          }

          .modalBody {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
          }

          .composeColumn {
            padding: 16px;
          }

          .sidePanel {
            border-left: none;
            border-top: 1px solid #c9bfa0;
            padding: 14px 16px;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 14px 20px;
            overflow: visible;
          }

          .tagSection {
            flex: 1;
            min-width: 160px;
          }

          .footerHint:not(.uploadingHint) {
            display: none;
          }

          .tipSection {
            display: none;
          }

          .previewPane {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}

const MEDIA_ACCEPT: Record<MediaKind, string | undefined> = {
  image: "image/*",
  video: "video/*",
  file: undefined,
};

const URL_LABELS: Record<Exclude<UrlMode, null>, { label: string; placeholder: string }> = {
  link: { label: "LINK URL", placeholder: "https://..." },
  image: { label: "IMAGE", placeholder: "Paste an image URL..." },
  video: { label: "VIDEO", placeholder: "Paste a video URL (.mp4, .webm)..." },
  file: { label: "FILE", placeholder: "Paste a file URL..." },
};

function Toolbar({ editor, onUpload }: { editor: Editor; onUpload: (files: File[], kind: MediaKind) => void }) {
  const [urlMode, setUrlMode] = useState<UrlMode>(null);
  const [url, setUrl] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      highlight: editor.isActive("highlight"),
      code: editor.isActive("code"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      codeBlock: editor.isActive("codeBlock"),
      link: editor.isActive("link"),
      alignLeft: editor.isActive({ textAlign: "left" }),
      alignCenter: editor.isActive({ textAlign: "center" }),
      alignRight: editor.isActive({ textAlign: "right" }),
      alignJustify: editor.isActive({ textAlign: "justify" }),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  useEffect(() => {
    if (urlMode) urlInputRef.current?.focus();
  }, [urlMode]);

  function openUrl(mode: Exclude<UrlMode, null>) {
    if (urlMode === mode) {
      setUrlMode(null);
      return;
    }
    setUrl(mode === "link" ? (editor.getAttributes("link").href ?? "") : "");
    setUrlMode(mode);
  }

  function applyUrl() {
    const value = url.trim();
    if (urlMode === "link") {
      if (value) {
        editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
      } else {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      }
    } else if (urlMode === "image" && value) {
      editor.chain().focus().setImage({ src: value }).run();
    } else if (urlMode === "video" && value) {
      editor.chain().focus().insertContent({ type: "video", attrs: { src: value } }).run();
    } else if (urlMode === "file" && value) {
      const name = decodeURIComponent(value.split(/[?#]/)[0].split("/").pop() || "") || "Attachment";
      editor.chain().focus().insertContent({ type: "fileAttachment", attrs: { href: value, name } }).run();
    }
    setUrlMode(null);
  }

  function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length && urlMode && urlMode !== "link") onUpload(files, urlMode);
    setUrlMode(null);
  }

  const chain = () => editor.chain().focus();

  return (
    <div className="toolbarWrap">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        <ToolGroup>
          <ToolBtn label="Undo" onClick={() => chain().undo().run()} disabled={!state.canUndo}>
            <Icon d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
          </ToolBtn>
          <ToolBtn label="Redo" onClick={() => chain().redo().run()} disabled={!state.canRedo}>
            <Icon d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
          </ToolBtn>
        </ToolGroup>

        <ToolGroup>
          <ToolBtn label="Heading 1" active={state.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
            <span className="textIcon">H1</span>
          </ToolBtn>
          <ToolBtn label="Heading 2" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
            <span className="textIcon">H2</span>
          </ToolBtn>
          <ToolBtn label="Heading 3" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
            <span className="textIcon">H3</span>
          </ToolBtn>
        </ToolGroup>

        <ToolGroup>
          <ToolBtn label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
            <Icon d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" strokeWidth={2.6} />
          </ToolBtn>
          <ToolBtn label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
            <Icon d="M19 4h-9M14 20H5M15 4 9 20" />
          </ToolBtn>
          <ToolBtn label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
            <Icon d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" />
          </ToolBtn>
          <ToolBtn label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
            <Icon d="M4 12h16M16 6.5A4 3 0 0 0 12 5c-2.5 0-4 1.3-4 3 0 1.2.8 2.2 2.5 3M8 17.5A4 3 0 0 0 12 19c2.5 0 4-1.3 4-3" />
          </ToolBtn>
          <ToolBtn label="Highlight" active={state.highlight} onClick={() => chain().toggleHighlight().run()}>
            <Icon d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
          </ToolBtn>
          <ToolBtn label="Inline code" active={state.code} onClick={() => chain().toggleCode().run()}>
            <Icon d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
          </ToolBtn>
        </ToolGroup>

        <ToolGroup>
          <ToolBtn label="Bullet list" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
            <Icon d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" strokeWidth={2.4} />
          </ToolBtn>
          <ToolBtn label="Numbered list" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
            <Icon d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </ToolBtn>
          <ToolBtn label="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
            <Icon d="M3 21c3 0 7-1 7-8V5H3v7h4c0 3.5-1.5 5-4 5zM14 21c3 0 7-1 7-8V5h-7v7h4c0 3.5-1.5 5-4 5z" />
          </ToolBtn>
          <ToolBtn label="Code block" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
            <Icon d="M4 4h16v16H4zM9 9l-2 3 2 3M15 9l2 3-2 3" />
          </ToolBtn>
          <ToolBtn label="Divider" onClick={() => chain().setHorizontalRule().run()}>
            <Icon d="M3 12h18" />
          </ToolBtn>
        </ToolGroup>

        <ToolGroup>
          <ToolBtn label="Align left" active={state.alignLeft} onClick={() => chain().setTextAlign("left").run()}>
            <Icon d="M3 6h18M3 12h12M3 18h16" />
          </ToolBtn>
          <ToolBtn label="Align center" active={state.alignCenter} onClick={() => chain().setTextAlign("center").run()}>
            <Icon d="M3 6h18M6 12h12M4 18h16" />
          </ToolBtn>
          <ToolBtn label="Align right" active={state.alignRight} onClick={() => chain().setTextAlign("right").run()}>
            <Icon d="M3 6h18M9 12h12M5 18h16" />
          </ToolBtn>
          <ToolBtn label="Justify" active={state.alignJustify} onClick={() => chain().setTextAlign("justify").run()}>
            <Icon d="M3 6h18M3 12h18M3 18h18" />
          </ToolBtn>
        </ToolGroup>

        <ToolGroup>
          <ToolBtn label="Link" active={state.link || urlMode === "link"} onClick={() => openUrl("link")}>
            <Icon d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </ToolBtn>
          <ToolBtn label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
            <Icon d="M4 7V4h16v3M9 20h6M12 4 8 20M3 3l18 18" />
          </ToolBtn>
        </ToolGroup>

        <ToolGroup>
          <ToolBtn label="Image" active={urlMode === "image"} onClick={() => openUrl("image")}>
            <Icon d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01" />
          </ToolBtn>
          <ToolBtn label="Video" active={urlMode === "video"} onClick={() => openUrl("video")}>
            <Icon d="M3 6h13v12H3zM16 10l5-3v10l-5-3" />
          </ToolBtn>
          <ToolBtn label="File" active={urlMode === "file"} onClick={() => openUrl("file")}>
            <Icon d="m21 11-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l8-7.9" />
          </ToolBtn>
        </ToolGroup>
      </div>

      {urlMode && (
        <div className="urlBar">
          <span className="urlLabel mono">{URL_LABELS[urlMode].label}</span>
          <input
            ref={urlInputRef}
            type="text"
            className="urlInput"
            placeholder={URL_LABELS[urlMode].placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyUrl();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setUrlMode(null);
                editor.commands.focus();
              }
            }}
          />
          <button type="button" className="urlBtn" onClick={applyUrl}>
            {urlMode === "link" && !url.trim() && state.link ? "Remove" : urlMode === "link" ? "Apply" : "Insert"}
          </button>
          {urlMode !== "link" && (
            <>
              <span className="urlOr mono">OR</span>
              <button type="button" className="urlBtn upload" onClick={() => fileInputRef.current?.click()}>
                <Icon d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept={MEDIA_ACCEPT[urlMode]}
                onChange={pickFiles}
              />
            </>
          )}
          <button type="button" className="urlBtn ghost" onClick={() => setUrlMode(null)}>
            Cancel
          </button>
        </div>
      )}

      <style jsx>{`
        .toolbarWrap {
          flex-shrink: 0;
          border-bottom: 1px solid #c9bfa0;
          background: var(--vellum);
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
        }

        .textIcon {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 700;
          font-size: 12.5px;
          line-height: 1;
        }

        .urlBar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-top: 1px dashed #c9bfa0;
          animation: fadeIn 0.12s ease backwards;
        }

        .urlLabel {
          font-size: 10.5px;
          letter-spacing: 0.08em;
          color: var(--navy);
          flex-shrink: 0;
        }

        .urlInput {
          flex: 1;
          margin-bottom: 0 !important;
          padding: 6px 10px !important;
          font-size: 13px !important;
          box-shadow: none !important;
        }

        .urlBtn {
          background: var(--navy);
          border: 1px solid var(--navy);
          color: var(--white);
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 5px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .urlBtn.upload {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--orange);
          border-color: var(--orange);
        }

        .urlBtn.upload:hover {
          background: #b84418;
          border-color: #b84418;
        }

        .urlOr {
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--ink-soft);
          flex-shrink: 0;
        }

        .urlBtn.ghost {
          background: transparent;
          color: var(--navy);
          border-color: #c9bfa0;
        }
      `}</style>
    </div>
  );
}

function ToolGroup({ children }: { children: ReactNode }) {
  return (
    <div className="toolGroup">
      {children}
      <style jsx>{`
        .toolGroup {
          display: flex;
          gap: 2px;
          padding-right: 6px;
          margin-right: 2px;
          border-right: 1px solid #d8cfb4;
        }

        .toolGroup:last-child {
          border-right: none;
        }
      `}</style>
    </div>
  );
}

const HOVER_DELAY_MS = 2000;

type ToolInfo = {
  description: string;
  // "Mod" is Ctrl on Windows/Linux and ⌘ on Mac, matching Tiptap's keymaps.
  keys?: string[];
  // Sample of how the result looks in a published post.
  preview?: ReactNode;
};

const TOOL_INFO: Record<string, ToolInfo> = {
  Undo: { description: "Revert your last change.", keys: ["Mod", "Z"] },
  Redo: { description: "Bring back a change you undid.", keys: ["Mod", "Shift", "Z"] },
  "Heading 1": { description: "Large section title.", keys: ["Mod", "Alt", "1"], preview: <h1>Engineering Days</h1> },
  "Heading 2": { description: "Medium subheading.", keys: ["Mod", "Alt", "2"], preview: <h2>Registration</h2> },
  "Heading 3": { description: "Small subheading.", keys: ["Mod", "Alt", "3"], preview: <h3>What to bring</h3> },
  Bold: {
    description: "Make text stand out.",
    keys: ["Mod", "B"],
    preview: <p>Deadline is <strong>Oct 15</strong>.</p>,
  },
  Italic: {
    description: "Emphasise a word or phrase.",
    keys: ["Mod", "I"],
    preview: <p>Bring your <em>own</em> laptop.</p>,
  },
  Underline: {
    description: "Underline the selected text.",
    keys: ["Mod", "U"],
    preview: <p><u>No late submissions.</u></p>,
  },
  Strikethrough: {
    description: "Cross out text that no longer applies.",
    keys: ["Mod", "Shift", "S"],
    preview: <p>Venue: <s>Room 204</s> Room 301</p>,
  },
  Highlight: {
    description: "Mark key details in yellow.",
    keys: ["Mod", "Shift", "H"],
    preview: <p>Pay your dues by <mark>Friday</mark>.</p>,
  },
  "Inline code": {
    description: "Monospace text for codes, IDs or commands.",
    keys: ["Mod", "E"],
    preview: <p>Use promo code <code>SOE2026</code></p>,
  },
  "Bullet list": {
    description: "Unordered list of points.",
    keys: ["Mod", "Shift", "8"],
    preview: (
      <ul>
        <li>Valid school ID</li>
        <li>Registration form</li>
      </ul>
    ),
  },
  "Numbered list": {
    description: "Ordered list for steps or rankings.",
    keys: ["Mod", "Shift", "7"],
    preview: (
      <ol>
        <li>Sign up online</li>
        <li>Pay the fee</li>
      </ol>
    ),
  },
  Quote: {
    description: "Set apart a quote or an important note.",
    keys: ["Mod", "Shift", "B"],
    preview: <blockquote>Submit through your respective faculty.</blockquote>,
  },
  "Code block": {
    description: "Multi-line block of monospace text.",
    keys: ["Mod", "Alt", "C"],
    preview: (
      <pre>
        <code>{"Room 301 · 8:00 AM\nRoom 302 · 1:00 PM"}</code>
      </pre>
    ),
  },
  Divider: {
    description: "Horizontal line to separate sections.",
    preview: (
      <>
        <p>Part one</p>
        <hr />
        <p>Part two</p>
      </>
    ),
  },
  "Align left": {
    description: "Align the paragraph to the left.",
    keys: ["Mod", "Shift", "L"],
    preview: <p style={{ textAlign: "left" }}>Line of text<br />Shorter line</p>,
  },
  "Align center": {
    description: "Center the paragraph.",
    keys: ["Mod", "Shift", "E"],
    preview: <p style={{ textAlign: "center" }}>Line of text<br />Shorter line</p>,
  },
  "Align right": {
    description: "Align the paragraph to the right.",
    keys: ["Mod", "Shift", "R"],
    preview: <p style={{ textAlign: "right" }}>Line of text<br />Shorter line</p>,
  },
  Justify: {
    description: "Stretch lines to both edges.",
    keys: ["Mod", "Shift", "J"],
    preview: <p style={{ textAlign: "justify" }}>Justified text spreads each line out so both edges line up evenly.</p>,
  },
  Link: {
    description: "Turn the selected text into a link, or edit the current one.",
    preview: <p>Read the <a>full guidelines</a> here.</p>,
  },
  "Clear formatting": {
    description: "Reset the selection to plain paragraph text.",
    preview: <p><strong><mark>Styled</mark></strong> → Plain</p>,
  },
  Image: {
    description: "Upload an image, drop or paste one in, or insert from a URL.",
    // eslint-disable-next-line @next/next/no-img-element
    preview: <img src="/promo-bg.png" alt="" />,
  },
  Video: {
    description: "Upload a video or insert one from a URL. It plays inside the post.",
    preview: (
      <div className="mockVideo">
        <span className="mockPlay" />
      </div>
    ),
  },
  File: {
    description: "Attach a PDF, document or any file for people to download.",
    preview: (
      <a className="fileAttachment">
        <span className="fileExt">PDF</span>
        <span className="fileMeta">
          <span className="fileName">GA_minutes.pdf</span>
          <span className="fileSize">1.2 MB · Download</span>
        </span>
      </a>
    ),
  },
};

function ToolBtn({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const info = TOOL_INFO[label];

  function show(delay: number) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (wrapRef.current) setAnchor(wrapRef.current.getBoundingClientRect());
    }, delay);
  }

  function hide() {
    window.clearTimeout(timerRef.current);
    setAnchor(null);
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <span
      ref={wrapRef}
      className="toolBtnWrap"
      onMouseEnter={() => show(HOVER_DELAY_MS)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
    >
      <button
        type="button"
        className={`toolBtn${active ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
      >
        {children}
      </button>
      {anchor && info && <ToolInfoCard label={label} info={info} anchor={anchor} />}
      <style jsx>{`
        .toolBtnWrap {
          display: flex;
        }

        .toolBtn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid transparent;
          border-radius: 4px;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .toolBtn:hover:not(:disabled) {
          background: var(--vellum-2);
          color: var(--navy);
        }

        .toolBtn.active {
          background: var(--navy);
          color: var(--white);
        }

        .toolBtn.active:hover:not(:disabled) {
          background: var(--navy-deep);
          color: var(--white);
        }

        .toolBtn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .toolBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }
      `}</style>
    </span>
  );
}

const CARD_WIDTH = 240;

function ToolInfoCard({ label, info, anchor }: { label: string; info: ToolInfo; anchor: DOMRect }) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const keys = info.keys?.map((key) => (key === "Mod" ? (isMac ? "⌘" : "Ctrl") : key === "Alt" && isMac ? "⌥" : key));

  // Center under the button, but keep the card inside the viewport.
  const left = Math.min(
    Math.max(8, anchor.left + anchor.width / 2 - CARD_WIDTH / 2),
    window.innerWidth - CARD_WIDTH - 8
  );
  const arrowLeft = anchor.left + anchor.width / 2 - left;

  return createPortal(
    <div className="toolInfo" role="tooltip" style={{ top: anchor.bottom + 8, left, width: CARD_WIDTH }}>
      <span className="arrow" style={{ left: arrowLeft }} />
      <div className="infoHead">
        <span className="infoTitle">{label}</span>
        {keys && (
          <span className="keys">
            {keys.map((key, i) => (
              <span key={key}>
                {i > 0 && <span className="plus">+</span>}
                <kbd>{key}</kbd>
              </span>
            ))}
          </span>
        )}
      </div>
      <p className="infoDesc">{info.description}</p>
      {info.preview && (
        <div className="previewBox" aria-hidden="true">
          <span className="previewLabel mono">PREVIEW</span>
          <div className="richText">{info.preview}</div>
        </div>
      )}
      <style jsx>{`
        .toolInfo {
          position: fixed;
          z-index: 200;
          background: var(--navy-deep);
          color: var(--white);
          border-radius: 6px;
          padding: 10px 12px 12px;
          box-shadow: 0 10px 28px rgba(13, 30, 56, 0.35);
          pointer-events: none;
          transform-origin: top center;
          animation: popIn 0.12s ease backwards;
        }

        .arrow {
          position: absolute;
          top: -5px;
          width: 10px;
          height: 10px;
          margin-left: -5px;
          background: var(--navy-deep);
          transform: rotate(45deg);
          border-radius: 2px;
        }

        .infoHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-bottom: 2px solid var(--orange);
          padding-bottom: 5px;
          margin-bottom: 5px;
        }

        .infoTitle {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          font-size: 13px;
        }

        .infoDesc {
          margin: 0;
          font-size: 12px;
          line-height: 1.45;
          color: #c6d3e5;
        }

        .keys {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .plus {
          margin: 0 2px;
          font-size: 10px;
          color: #c6d3e5;
        }

        kbd {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
          padding: 0 4px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-bottom-width: 2px;
          color: var(--yellow);
        }

        .previewBox {
          position: relative;
          margin-top: 9px;
          padding: 16px 10px 9px;
          background: var(--white);
          border-radius: 4px;
          color: var(--ink);
          overflow: hidden;
        }

        .previewLabel {
          position: absolute;
          top: 3px;
          right: 6px;
          font-size: 8.5px;
          letter-spacing: 0.08em;
          color: var(--ink-soft);
          opacity: 0.7;
        }

        .previewBox .richText {
          font-size: 12px;
          line-height: 1.5;
        }

        .previewBox :global(h1) {
          font-size: 18px;
        }

        .previewBox :global(h2) {
          font-size: 15.5px;
        }

        .previewBox :global(h3) {
          font-size: 13.5px;
        }

        .previewBox :global(hr) {
          margin: 6px 0;
        }

        .previewBox :global(pre) {
          padding: 6px 8px;
          font-size: 11px;
        }

        .previewBox :global(blockquote) {
          padding: 5px 10px;
        }

        .previewBox :global(img) {
          width: 100%;
          height: 72px;
          object-fit: cover;
        }

        .previewBox :global(.mockVideo) {
          height: 72px;
          border-radius: 6px;
          background: linear-gradient(135deg, var(--navy), var(--navy-deep));
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .previewBox :global(.mockPlay) {
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 9px 0 9px 15px;
          border-color: transparent transparent transparent var(--white);
          margin-left: 4px;
        }

        .previewBox :global(a.fileAttachment) {
          max-width: none;
          padding: 6px 8px;
        }
      `}</style>
    </div>,
    document.body
  );
}

function Icon({ d, strokeWidth = 2 }: { d: string; strokeWidth?: number }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
