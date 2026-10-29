"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import NextImage from "next/image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import FileHandler from "@tiptap/extension-file-handler";
import { NodeSelection } from "@tiptap/pm/state";
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

// The part of the screen an on-screen keyboard leaves visible, or null while no keyboard is up.
// Phones overlay the keyboard on fixed elements instead of shrinking them, so the modal fits itself into this.
function useKeyboardViewport() {
  const [view, setView] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const viewport = vv;
    function update() {
      // Pinch-zoom also shrinks the visual viewport; only a big drop at normal scale is a keyboard.
      const keyboardUp = viewport.scale < 1.05 && window.innerHeight - viewport.height > 120;
      setView(keyboardUp ? { top: viewport.offsetTop, height: viewport.height } : null);
    }
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return view;
}

export default function CreatePostModal({
  currentUser,
  tags,
  initialPost,
  draft,
  initialError,
  onClose,
  onSubmit,
}: {
  currentUser: User;
  tags: string[];
  // When set, the modal edits this post instead of creating a new one.
  initialPost?: NewPost & { postedAt: string };
  // Reopens the modal with what the user had written, e.g. after a failed publish.
  draft?: NewPost;
  initialError?: string;
  onClose: () => void;
  // Called once and the modal closes straight away; the post shows optimistically.
  onSubmit: (post: NewPost) => void;
}) {
  const isEdit = !!initialPost;
  const [title, setTitle] = useState(draft?.title ?? initialPost?.title ?? "");
  const [tag, setTag] = useState(draft?.tag ?? initialPost?.tag ?? tags[0] ?? "");
  // A restored draft counts as unsaved work, so closing it asks first.
  const [bodyChanged, setBodyChanged] = useState(!!draft);
  const [showDiscard, setShowDiscard] = useState(false);
  const backdrop = useBackdropDismiss(requestClose);
  const [error, setError] = useState(initialError ?? "");
  const [uploading, setUploading] = useState(0);
  // Snapshot of the editor body while previewing; null while editing.
  const [preview, setPreview] = useState<{ html: string; at: string } | null>(null);
  const [supabase] = useState(() => createClient());
  const titleRef = useRef<HTMLInputElement>(null);
  const keyboardView = useKeyboardViewport();

  // Uploads the files to Storage together, then inserts them in their original order at `pos`
  // (drop target) or the cursor. Inserting them as one batch keeps them back to back, which is
  // what groups them into a gallery in the post.
  async function insertFiles(target: Editor, files: File[], kind?: MediaKind, pos?: number) {
    setError("");
    setUploading((n) => n + files.length);
    const results = await Promise.allSettled(
      files.map((file) => uploadMedia(supabase, currentUser.id, file).finally(() => setUploading((n) => n - 1)))
    );

    const nodes = [];
    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled") {
        nodes.push(mediaNode(result.value, kind));
      } else {
        console.error("Error uploading announcement media:", result.reason);
        const reason = result.reason;
        setError(reason instanceof Error && reason.message ? reason.message : `Couldn't upload "${files[i].name}".`);
      }
    }
    if (!nodes.length) return;

    // With an image selected, inserting would replace it; put the new ones after it instead.
    const { selection } = target.state;
    const at = pos ?? (selection instanceof NodeSelection ? selection.to : undefined);
    const chain = target.chain().focus();
    (at === undefined ? chain.insertContent(nodes) : chain.insertContentAt(at, nodes)).run();

    // Leave the cursor on the line below, not on the last image, where the next keystroke would replace it.
    const end = target.state.selection.to;
    if (target.state.doc.resolve(end).nodeAfter?.isTextblock) target.commands.setTextSelection(end + 1);
    else target.chain().insertContentAt(end, { type: "paragraph" }).setTextSelection(end + 1).run();
  }

  const editor = useEditor({
    immediatelyRender: false,
    content: draft ? toEditorHtml(draft.content) : initialPost ? toEditorHtml(initialPost.content) : "",
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
    title.trim() !== "" && tag !== "" && !(counts?.isEmpty ?? true) && uploading === 0;

  // Asks via the discard panel first when there's something to lose.
  function requestClose() {
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
      if (e.key !== "Escape" || e.defaultPrevented || showDiscard) return;
      if (isDirty) setShowDiscard(true);
      else onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDirty, showDiscard, onClose]);

  // The keyboard just took (or gave back) space; keep the caret in view.
  useEffect(() => {
    if (!editor?.isFocused) return;
    const frame = requestAnimationFrame(() => editor.commands.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [editor, keyboardView?.height]);

  function hideKeyboard() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

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

  function publish(event: FormEvent) {
    event.preventDefault();
    if (!editor || !canPublish) return;
    onSubmit({ title: title.trim(), tag, content: editor.getHTML() });
    onClose();
  }

  return (
    <div
      className="modalBackdrop"
      {...backdrop}
      style={keyboardView ? { top: keyboardView.top, bottom: "auto", height: keyboardView.height } : undefined}
    >
      <form
        className={`modalPanel${keyboardView ? " keyboardUp" : ""}`}
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
              onKeyDown={(e) => {
                // Enter moves on to the body instead of submitting a half-written post.
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  editor?.commands.focus();
                }
              }}
              enterKeyHint="next"
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
                {currentUser.avatar_path ? (
                  <NextImage
                    src={currentUser.avatar_path}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 shrink-0 rounded-full border border-navy-tint object-cover"
                  />
                ) : (
                  <span className="avatar">{currentUser.initials}</span>
                )}
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
                Hover over a toolbar button for 2 seconds, or over a menu option, to see what it does, its shortcut, and a preview of the
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
          ) : keyboardView ? (
            <button type="button" className="doneBtn" onClick={hideKeyboard} aria-label="Hide keyboard">
              <Icon d="M3 5h18v10H3zM7 9h.01M11 9h.01M15 9h.01M8 12h8M9 19l3 2 3-2" />
              Done
            </button>
          ) : (
            <span className="footerHint mono">ESC TO CLOSE</span>
          )}
          <div className="footerActions">
            <button type="button" className="btn ghost cancelBtn" onClick={requestClose}>
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
              {isEdit ? "Save changes" : "Publish"}
            </button>
          </div>
        </div>
      </form>

      {showDiscard && (
        <ConfirmDialog
          tone="warning"
          eyebrow={isEdit ? "UNSAVED EDITS" : "UNSAVED DRAFT"}
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
          font-size: var(--fs-card) !important;
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

        /* Uploads stack one per line while editing; keep them small. Preview shows the real gallery layout. */
        .editorScroll :global(.editorContent img) {
          max-height: 240px;
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

        .doneBtn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          background: none;
          border: 1px solid #c9bfa0;
          border-radius: 5px;
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
          cursor: pointer;
        }

        /* Touch screens: iOS zooms into any field typed in below 16px. */
        @media (pointer: coarse) {
          .editorScroll :global(.editorContent) {
            font-size: 16px;
          }
        }

        /* On-screen keyboard is up: give the space to the text being typed. */
        .modalPanel.keyboardUp {
          height: 100%;
        }

        .keyboardUp .modalAccent,
        .keyboardUp .sidePanel,
        .keyboardUp .cancelBtn {
          display: none;
        }

        .keyboardUp .composeColumn {
          padding: 10px 12px;
          gap: 8px;
        }

        .keyboardUp .titleInput {
          font-size: 18px !important;
          padding-bottom: 6px !important;
        }

        .keyboardUp .editorScroll :global(.editorContent) {
          padding: 12px 14px 24px;
        }

        .keyboardUp .modalFooter {
          padding: 6px 12px;
        }

        .keyboardUp .footerActions .btn {
          padding: 7px 14px;
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

          .modalFooter {
            padding: 10px 16px;
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

        @media (max-width: 520px) {
          .composeColumn {
            padding: 12px;
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
  const [moreToRight, setMoreToRight] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    // On touch screens a media URL is the rarer path; don't pop the keyboard over the Upload button.
    if (urlMode && (urlMode === "link" || !window.matchMedia("(pointer: coarse)").matches)) {
      urlInputRef.current?.focus();
    }
  }, [urlMode]);

  // The toolbar scrolls sideways on narrow screens; fade its edge while tools are hidden past it.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setMoreToRight(hasMoreToRight(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
  const headingLabel = state.h1 ? "H1" : state.h2 ? "H2" : state.h3 ? "H3" : null;

  return (
    <div className="toolbarWrap">
      <div
        ref={scrollRef}
        className={`toolbarScroll${moreToRight ? " moreToRight" : ""}`}
        onScroll={(e) => setMoreToRight(hasMoreToRight(e.currentTarget))}
      >
        <div className="editorToolbar" role="toolbar" aria-label="Formatting">
          <ToolGroup>
            <ToolMenu
              label="Text style"
              active={!!headingLabel}
              trigger={<span className="textIcon styleIcon">{headingLabel ?? "Text"}</span>}
              sections={[
                {
                  items: [
                    {
                      label: "Normal text",
                      icon: <span className="textIcon">P</span>,
                      active: !headingLabel,
                      onSelect: () => chain().setParagraph().run(),
                    },
                    {
                      label: "Heading 1",
                      icon: <span className="textIcon">H1</span>,
                      active: state.h1,
                      onSelect: () => chain().setHeading({ level: 1 }).run(),
                    },
                    {
                      label: "Heading 2",
                      icon: <span className="textIcon">H2</span>,
                      active: state.h2,
                      onSelect: () => chain().setHeading({ level: 2 }).run(),
                    },
                    {
                      label: "Heading 3",
                      icon: <span className="textIcon">H3</span>,
                      active: state.h3,
                      onSelect: () => chain().setHeading({ level: 3 }).run(),
                    },
                  ],
                },
              ]}
            />
          </ToolGroup>

          <ToolGroup>
            <ToolBtn label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
              <Icon d={ICONS.bold} strokeWidth={2.6} />
            </ToolBtn>
            <ToolBtn label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
              <Icon d={ICONS.italic} />
            </ToolBtn>
            <ToolBtn label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
              <Icon d={ICONS.underline} />
            </ToolBtn>
            <ToolMenu
              label="More formatting"
              active={state.strike || state.highlight || state.code}
              chevron={false}
              trigger={<Icon d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />}
              sections={[
                {
                  items: [
                    {
                      label: "Strikethrough",
                      icon: <Icon d={ICONS.strike} />,
                      active: state.strike,
                      onSelect: () => chain().toggleStrike().run(),
                    },
                    {
                      label: "Highlight",
                      icon: <Icon d={ICONS.highlight} />,
                      active: state.highlight,
                      onSelect: () => chain().toggleHighlight().run(),
                    },
                    {
                      label: "Inline code",
                      icon: <Icon d={ICONS.code} />,
                      active: state.code,
                      onSelect: () => chain().toggleCode().run(),
                    },
                  ],
                },
                {
                  items: [
                    {
                      label: "Clear formatting",
                      icon: <Icon d={ICONS.clear} />,
                      onSelect: () => chain().unsetAllMarks().clearNodes().run(),
                    },
                  ],
                },
              ]}
            />
          </ToolGroup>

          <ToolGroup>
            <ToolMenu
              label="Paragraph"
              active={state.bulletList || state.orderedList || state.blockquote || state.codeBlock}
              trigger={<Icon d={ICONS.bulletList} strokeWidth={2.4} />}
              sections={[
                {
                  items: [
                    {
                      label: "Bullet list",
                      icon: <Icon d={ICONS.bulletList} strokeWidth={2.4} />,
                      active: state.bulletList,
                      onSelect: () => chain().toggleBulletList().run(),
                    },
                    {
                      label: "Numbered list",
                      icon: <Icon d={ICONS.orderedList} />,
                      active: state.orderedList,
                      onSelect: () => chain().toggleOrderedList().run(),
                    },
                    {
                      label: "Quote",
                      icon: <Icon d={ICONS.quote} />,
                      active: state.blockquote,
                      onSelect: () => chain().toggleBlockquote().run(),
                    },
                    {
                      label: "Code block",
                      icon: <Icon d={ICONS.codeBlock} />,
                      active: state.codeBlock,
                      onSelect: () => chain().toggleCodeBlock().run(),
                    },
                    {
                      label: "Divider",
                      icon: <Icon d="M3 12h18" />,
                      onSelect: () => chain().setHorizontalRule().run(),
                    },
                  ],
                },
                {
                  title: "Align",
                  inline: true,
                  items: [
                    {
                      label: "Align left",
                      icon: <Icon d="M3 6h18M3 12h12M3 18h16" />,
                      active: state.alignLeft,
                      onSelect: () => chain().setTextAlign("left").run(),
                    },
                    {
                      label: "Align center",
                      icon: <Icon d="M3 6h18M6 12h12M4 18h16" />,
                      active: state.alignCenter,
                      onSelect: () => chain().setTextAlign("center").run(),
                    },
                    {
                      label: "Align right",
                      icon: <Icon d="M3 6h18M9 12h12M5 18h16" />,
                      active: state.alignRight,
                      onSelect: () => chain().setTextAlign("right").run(),
                    },
                    {
                      label: "Justify",
                      icon: <Icon d="M3 6h18M3 12h18M3 18h18" />,
                      active: state.alignJustify,
                      onSelect: () => chain().setTextAlign("justify").run(),
                    },
                  ],
                },
              ]}
            />
          </ToolGroup>

          <ToolGroup>
            <ToolBtn label="Link" active={state.link || urlMode === "link"} onClick={() => openUrl("link")}>
              <Icon d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </ToolBtn>
            <ToolMenu
              label="Insert"
              active={urlMode !== null && urlMode !== "link"}
              trigger={<Icon d="M12 5v14M5 12h14" strokeWidth={2.4} />}
              sections={[
                {
                  items: [
                    {
                      label: "Image",
                      icon: <Icon d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01" />,
                      onSelect: () => openUrl("image"),
                    },
                    {
                      label: "Video",
                      icon: <Icon d="M3 6h13v12H3zM16 10l5-3v10l-5-3" />,
                      onSelect: () => openUrl("video"),
                    },
                    {
                      label: "File",
                      icon: (
                        <Icon d="m21 11-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l8-7.9" />
                      ),
                      onSelect: () => openUrl("file"),
                    },
                  ],
                },
              ]}
            />
          </ToolGroup>

          <ToolGroup end>
            <ToolBtn label="Undo" onClick={() => chain().undo().run()} disabled={!state.canUndo}>
              <Icon d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
            </ToolBtn>
            <ToolBtn label="Redo" onClick={() => chain().redo().run()} disabled={!state.canRedo}>
              <Icon d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
            </ToolBtn>
          </ToolGroup>
        </div>
      </div>

      {urlMode && (
        <div className="urlBar">
          <span className="urlLabel mono">{URL_LABELS[urlMode].label}</span>
          <input
            ref={urlInputRef}
            type="text"
            inputMode="url"
            enterKeyHint="done"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
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
          <div className="urlActions">
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
        </div>
      )}

      <style jsx>{`
        .toolbarWrap {
          flex-shrink: 0;
          border-bottom: 1px solid #c9bfa0;
          background: var(--vellum);
        }

        /* One row everywhere; narrow screens swipe it sideways instead of wrapping onto a second row. */
        .toolbarScroll {
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
        }

        .toolbarScroll::-webkit-scrollbar {
          display: none;
        }

        .toolbarScroll.moreToRight {
          -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 20px), transparent);
          mask-image: linear-gradient(to right, #000 calc(100% - 20px), transparent);
        }

        .editorToolbar {
          display: flex;
          align-items: center;
          width: max-content;
          min-width: 100%;
          padding: 5px 8px;
        }

        .textIcon {
          font-family: "Space Grotesk", sans-serif;
          font-weight: 700;
          font-size: 12.5px;
          line-height: 1;
        }

        /* Fixed width so the toolbar doesn't shift as it flips between "Text" and "H1". */
        .styleIcon {
          min-width: 26px;
          text-align: center;
        }

        .urlBar {
          display: flex;
          flex-wrap: wrap;
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
          flex: 1 1 180px;
          min-width: 0;
          margin-bottom: 0 !important;
          padding: 6px 10px !important;
          font-size: 13px !important;
          box-shadow: none !important;
        }

        .urlActions {
          display: flex;
          align-items: center;
          gap: 8px;
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

        @media (max-width: 520px) {
          .editorToolbar {
            padding: 4px;
          }

          .urlInput {
            flex-basis: 100%;
            order: 1;
          }

          .urlActions {
            order: 2;
            width: 100%;
          }

          .urlActions .urlBtn {
            flex: 1;
            justify-content: center;
            padding: 8px 12px;
          }
        }

        /* iOS zooms into any field typed in below 16px. */
        @media (pointer: coarse) {
          .urlInput {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

function hasMoreToRight(el: HTMLElement) {
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
}

const ICONS = {
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M19 4h-9M14 20H5M15 4 9 20",
  underline: "M7 4v6a5 5 0 0 0 10 0V4M5 20h14",
  strike: "M4 12h16M16 6.5A4 3 0 0 0 12 5c-2.5 0-4 1.3-4 3 0 1.2.8 2.2 2.5 3M8 17.5A4 3 0 0 0 12 19c2.5 0 4-1.3 4-3",
  highlight: "m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  clear: "M4 7V4h16v3M9 20h6M12 4 8 20M3 3l18 18",
  bulletList: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  orderedList: "M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",
  quote: "M3 21c3 0 7-1 7-8V5H3v7h4c0 3.5-1.5 5-4 5zM14 21c3 0 7-1 7-8V5h-7v7h4c0 3.5-1.5 5-4 5z",
  codeBlock: "M4 4h16v16H4zM9 9l-2 3 2 3M15 9l2 3-2 3",
};

function ToolGroup({ end = false, children }: { end?: boolean; children: ReactNode }) {
  return (
    <div className={`toolGroup${end ? " end" : ""}`}>
      {children}
      <style jsx>{`
        .toolGroup {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 0 6px;
        }

        .toolGroup:first-child {
          padding-left: 0;
        }

        .toolGroup:last-child {
          padding-right: 0;
        }

        .toolGroup + .toolGroup {
          border-left: 1px solid #d8cfb4;
        }

        /* Pinned to the far end; on narrow screens it's the part that scrolls out of view. */
        .toolGroup.end {
          margin-left: auto;
        }

        @media (max-width: 520px) {
          .toolGroup {
            padding: 0 4px;
          }
        }
      `}</style>
    </div>
  );
}

type MenuItem = {
  // Also the TOOL_INFO key its shortcut comes from.
  label: string;
  icon: ReactNode;
  // Left undefined for one-off actions (insert, clear); set for formats that can be on or off.
  active?: boolean;
  onSelect: () => void;
};

// `inline` lays the items out as one row of icon buttons, e.g. the alignment options.
type MenuSection = { title?: string; inline?: boolean; items: MenuItem[] };

const MENU_WIDTH = 244;
// Someone who opened a menu is already looking for something, so options explain themselves sooner than buttons.
const MENU_HOVER_DELAY_MS = 500;

function ToolMenu({
  label,
  trigger,
  active = false,
  chevron = true,
  sections,
}: {
  label: string;
  trigger: ReactNode;
  active?: boolean;
  chevron?: boolean;
  sections: MenuSection[];
}) {
  const [place, setPlace] = useState<{ left: number; top: number; above: boolean; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusFirstItem = useRef(false);
  const [hint, setHint] = useState<{ label: string; anchor: DOMRect; menu: DOMRect } | null>(null);
  const hintTimer = useRef<number | undefined>(undefined);
  const open = place !== null;

  // The same info card as the toolbar buttons, shown next to the menu for the option under the mouse or keyboard.
  function showHint(item: HTMLElement, label: string, delay: number) {
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      const menu = menuRef.current?.getBoundingClientRect();
      if (menu && item.isConnected) setHint({ label, anchor: item.getBoundingClientRect(), menu });
    }, delay);
  }

  function hideHint() {
    window.clearTimeout(hintTimer.current);
    setHint(null);
  }

  function openMenu(byKeyboard: boolean) {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Measure against what's actually visible, which excludes an on-screen keyboard.
    const vv = window.visualViewport;
    const viewTop = vv?.offsetTop ?? 0;
    const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
    const viewRight = (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth);
    const spaceBelow = viewBottom - rect.bottom - 12;
    const spaceAbove = rect.top - viewTop - 12;
    const above = spaceBelow < 200 && spaceAbove > spaceBelow;
    focusFirstItem.current = byKeyboard;
    setPlace({
      left: Math.max(8, Math.min(rect.left, viewRight - MENU_WIDTH - 8)),
      top: above ? rect.top - 4 : rect.bottom + 4,
      above,
      maxHeight: above ? spaceAbove : spaceBelow,
    });
  }

  function menuItems() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']") ?? []);
  }

  useEffect(() => {
    if (!open) return;
    if (focusFirstItem.current) menuItems()[0]?.focus();

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setPlace(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Esc closes just the menu; the modal skips Esc presses that were already handled.
      e.preventDefault();
      const focusInMenu = menuRef.current?.contains(document.activeElement);
      setPlace(null);
      if (focusInMenu) triggerRef.current?.focus();
    }
    // The menu is pinned where the trigger was, so anything that moves the trigger closes it.
    function onMove(e: Event) {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) setPlace(null);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.clearTimeout(hintTimer.current);
      setHint(null);
    };
  }, [open]);

  function choose(item: MenuItem) {
    setPlace(null);
    item.onSelect();
  }

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "Tab") {
      e.preventDefault();
      setPlace(null);
      triggerRef.current?.focus();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      items[next].focus();
    }
  }

  return (
    <>
      <ToolBtn
        label={label}
        active={active}
        expanded={open}
        wide={chevron}
        buttonRef={triggerRef}
        // detail is 0 when Enter or Space "clicked" it; then focus moves into the menu.
        onClick={(e) => (open ? setPlace(null) : openMenu(e.detail === 0))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openMenu(true);
          }
        }}
      >
        {trigger}
        {chevron && (
          <svg className="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </ToolBtn>

      {place &&
        createPortal(
          <div
            className="menuPlace"
            style={{ left: place.left, top: place.top, width: MENU_WIDTH, transform: place.above ? "translateY(-100%)" : undefined }}
          >
            <div
              ref={menuRef}
              className={`toolMenu${place.above ? " above" : ""}`}
              role="menu"
              aria-label={label}
              style={{ maxHeight: place.maxHeight }}
              onKeyDown={onMenuKeyDown}
            >
              {sections.map((section, s) => (
                <div key={s} className="menuSection" role="group" aria-label={section.title}>
                  {section.title && <span className="menuTitle mono">{section.title}</span>}
                  <div className={section.inline ? "inlineItems" : "listItems"}>
                    {section.items.map((item) => {
                      const keys = TOOL_INFO[item.label]?.keys;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          role={item.active === undefined ? "menuitem" : "menuitemcheckbox"}
                          aria-checked={item.active}
                          aria-label={section.inline ? item.label : undefined}
                          title={section.inline ? item.label : undefined}
                          tabIndex={-1}
                          className={`menuItem${item.active ? " active" : ""}`}
                          // Keep the editor's selection (and the phone keyboard) while picking.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(item)}
                          onPointerEnter={(e) => {
                            if (e.pointerType === "mouse") showHint(e.currentTarget, item.label, MENU_HOVER_DELAY_MS);
                          }}
                          onPointerLeave={hideHint}
                          onFocus={(e) => {
                            if (e.currentTarget.matches(":focus-visible")) showHint(e.currentTarget, item.label, 0);
                          }}
                          onBlur={hideHint}
                        >
                          <span className="itemIcon">{item.icon}</span>
                          {!section.inline && <span className="itemLabel">{item.label}</span>}
                          {!section.inline && keys && <span className="itemKeys mono">{formatKeys(keys).join("+")}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}

      {place && hint && TOOL_INFO[hint.label] && (
        <ToolInfoCard label={hint.label} info={TOOL_INFO[hint.label]} anchor={hint.anchor} beside={hint.menu} />
      )}

      <style jsx>{`
        .chevron {
          flex-shrink: 0;
          opacity: 0.7;
        }

        .menuPlace {
          position: fixed;
          z-index: 150;
        }

        .toolMenu {
          overflow-y: auto;
          padding: 4px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          box-shadow: 0 10px 24px rgba(13, 30, 56, 0.16);
          transform-origin: top left;
          animation: popIn 0.12s ease backwards;
        }

        .toolMenu.above {
          transform-origin: bottom left;
        }

        .menuSection + .menuSection {
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid #e4dcc9;
        }

        .menuTitle {
          display: block;
          padding: 4px 10px 2px;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-soft);
        }

        .inlineItems {
          display: flex;
          gap: 2px;
          padding: 2px 4px 2px;
        }

        .menuItem {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 7px 10px;
          background: none;
          border: none;
          border-radius: 4px;
          font-family: "Inter", sans-serif;
          font-size: 13px;
          color: var(--ink);
          text-align: left;
          cursor: pointer;
        }

        .inlineItems .menuItem {
          flex: 1;
          justify-content: center;
          padding: 7px 0;
        }

        .menuItem:hover,
        .menuItem:focus-visible {
          background: var(--vellum);
          outline: none;
        }

        .menuItem.active {
          background: var(--vellum-2);
          color: var(--navy);
          font-weight: 600;
        }

        .inlineItems .menuItem.active {
          background: var(--navy);
          color: var(--white);
        }

        .itemIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          flex-shrink: 0;
          color: var(--navy);
        }

        .inlineItems .menuItem.active .itemIcon {
          color: inherit;
        }

        .itemLabel {
          flex: 1;
          white-space: nowrap;
        }

        .itemKeys {
          font-size: 10px;
          font-weight: 400;
          color: var(--ink-soft);
        }

        /* Shortcuts are noise on touch screens, and fingers need bigger rows. */
        @media (hover: none) {
          .itemKeys {
            display: none;
          }
        }

        @media (pointer: coarse) {
          .menuItem {
            padding: 10px 12px;
            font-size: 14px;
          }

          .inlineItems .menuItem {
            padding: 10px 0;
          }
        }
      `}</style>
    </>
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
  "Text style": { description: "Switch between normal text and headings." },
  "More formatting": { description: "Strikethrough, highlight, inline code, and clearing formatting." },
  Paragraph: {
    description: "Lists, quotes, code blocks, dividers and alignment.",
    preview: (
      <ul>
        <li>Valid school ID</li>
        <li>Registration form</li>
      </ul>
    ),
  },
  Insert: { description: "Add an image, video or file. You can also drop or paste them into the post." },
  "Normal text": { description: "Regular paragraph text.", keys: ["Mod", "Alt", "0"] },
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
  expanded,
  wide = false,
  buttonRef,
  onClick,
  onKeyDown,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  // Set only on a button that opens a menu: whether that menu is open.
  expanded?: boolean;
  // Sized to its content instead of square, e.g. an icon plus a dropdown chevron.
  wide?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
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
      // Mouse only: a tap on a phone also "enters" the button and would leave the card stuck open.
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") show(HOVER_DELAY_MS);
      }}
      onPointerLeave={hide}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) show(0);
      }}
      onBlur={hide}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`toolBtn${wide ? " wide" : ""}${expanded ? " open" : ""}${active ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-label={label}
        aria-pressed={expanded === undefined ? active : undefined}
        aria-haspopup={expanded === undefined ? undefined : "menu"}
        aria-expanded={expanded}
      >
        {children}
      </button>
      {anchor && info && !expanded && <ToolInfoCard label={label} info={info} anchor={anchor} />}
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
          gap: 2px;
          background: none;
          border: 1px solid transparent;
          border-radius: 4px;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .toolBtn.wide {
          width: auto;
          padding: 0 3px 0 5px;
        }

        .toolBtn:hover:not(:disabled),
        .toolBtn.open {
          background: var(--vellum-2);
          color: var(--navy);
        }

        .toolBtn.open {
          border-color: #c9bfa0;
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

        /* Bigger targets for fingers, kept small enough that everything but undo/redo fits a 360px phone. */
        @media (pointer: coarse) {
          .toolBtn {
            width: 32px;
            height: 32px;
          }

          .toolBtn.wide {
            width: auto;
          }
        }
      `}</style>
    </span>
  );
}

function formatKeys(keys: string[]) {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  return keys.map((key) => (key === "Mod" ? (isMac ? "⌘" : "Ctrl") : key === "Alt" && isMac ? "⌥" : key));
}

const CARD_WIDTH = 240;

function ToolInfoCard({
  label,
  info,
  anchor,
  beside,
}: {
  label: string;
  info: ToolInfo;
  anchor: DOMRect;
  // For a menu option: the open menu, so the card sits next to it instead of covering it.
  beside?: DOMRect;
}) {
  const keys = info.keys && formatKeys(info.keys);
  const cardRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Measured once shown, so a card beside the menu can be kept above the bottom of the screen.
  useLayoutEffect(() => {
    setHeight(cardRef.current?.offsetHeight ?? 0);
  }, [label]);

  let position: CSSProperties;
  let arrow: CSSProperties;
  if (beside) {
    const toRight = beside.right + 10 + CARD_WIDTH <= window.innerWidth - 8;
    const left = toRight ? beside.right + 10 : Math.max(8, beside.left - 10 - CARD_WIDTH);
    const middle = anchor.top + anchor.height / 2;
    const top = Math.max(8, Math.min(middle - 18, window.innerHeight - height - 8));
    position = { top, left, width: CARD_WIDTH };
    arrow = { top: middle - top - 5, left: toRight ? 0 : "100%" };
  } else {
    // Center under the button, but keep the card inside the viewport.
    const left = Math.min(
      Math.max(8, anchor.left + anchor.width / 2 - CARD_WIDTH / 2),
      window.innerWidth - CARD_WIDTH - 8
    );
    position = { top: anchor.bottom + 8, left, width: CARD_WIDTH };
    arrow = { left: anchor.left + anchor.width / 2 - left };
  }

  return createPortal(
    <div ref={cardRef} className="toolInfo" role="tooltip" style={position}>
      <span className="arrow" style={arrow} />
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
