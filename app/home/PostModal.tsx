"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import Image from "next/image";
import PostContent from "./PostContent";
import PostMenu from "./PostMenu";
import ConfirmDialog from "./ConfirmDialog";
import { getRelativeTime, type Announcement, type Comment, type User } from "@/app/home/HomeContent";

export default function PostModal({
  announcement,
  currentUser,
  onToggleReaction,
  onClose,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  canModerate = false,
}: {
  announcement: Announcement;
  currentUser: User;
  onToggleReaction: (postId: string) => void;
  onClose: () => void;
  onAddComment: (postId: string, body: string) => Promise<void>;
  onUpdateComment: (postId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  // Admins can delete anyone's comment (but only edit their own).
  canModerate?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const backdrop = useBackdropDismiss(onClose);
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commentCount = announcement.comments.length;
  const previousCommentCount = useRef(commentCount);

  useEffect(() => {
    if (commentCount > previousCommentCount.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    previousCommentCount.current = commentCount;
  }, [commentCount]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape closes the innermost thing first: the delete dialog handles itself,
      // then an open edit box, then the modal.
      if (deletingComment) return;
      if (editingId) {
        if (!savingEdit) cancelEdit();
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, deletingComment, editingId, savingEdit]);

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditDraft(comment.body);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditError("");
  }

  async function saveEdit(comment: Comment) {
    const trimmed = editDraft.trim();
    if (!trimmed || savingEdit) return;
    if (trimmed === comment.body) {
      cancelEdit();
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      await onUpdateComment(announcement.id, comment.id, trimmed);
      cancelEdit();
    } catch {
      setEditError("Couldn't save your changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setCommentError("");
    setDraft("");
    try {
      await onAddComment(announcement.id, trimmed);
    } catch {
      setDraft(trimmed);
      setCommentError("Couldn't post your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modalBackdrop" {...backdrop}>
      <div className="modalPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modalTopBar">
          <span className="modalTopBarTitle mono">
            <span className="modalTopBarIcon">
              <MegaphoneIcon />
            </span>
            Announcement
            {announcement.tag && (
              <>
                <span className="crumbSep" aria-hidden="true">/</span>
                <span className="crumbTag">{announcement.tag}</span>
              </>
            )}
          </span>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Close post">
            <CloseIcon />
          </button>
        </div>
        <div className="modalAccent"></div>

        <div className="modalScroll" ref={scrollRef}>
          <PostContent
            announcement={announcement}
            currentUser={currentUser}
            onToggleReaction={onToggleReaction}
            onCommentClick={() => inputRef.current?.focus()}
          />

          <div className="commentsList">
            <div className="commentsHead mono">
              <span className="commentsHeadIcon">
                <BubbleIcon />
              </span>
              Comments <span className="commentsCount">{commentCount}</span>
            </div>
            {commentCount === 0 ? (
              <button type="button" className="commentsEmpty" onClick={() => inputRef.current?.focus()}>
                <span className="commentsEmptyIcon">
                  <BubbleIcon />
                </span>
                <span>
                  <strong>No comments yet.</strong> Be the first to reply.
                </span>
              </button>
            ) : (
              announcement.comments.map((comment) => {
                // A comment still being posted has a temp id the database doesn't know yet.
                const isSaved = !comment.id.startsWith("temp-");
                const isOwn = comment.authorId === currentUser.id;
                const canEdit = isSaved && isOwn;
                const canDelete = isSaved && (isOwn || canModerate);
                const isEditing = editingId === comment.id;

                return (
                  <div className={`commentItem ${isSaved ? "" : "sending"}`} key={comment.id}>
                    <CommentAvatar src={comment.authorAvatar} initials={comment.authorInitials} />
                    <div className="commentBubble">
                      <div className="commentMeta">
                        <span className="commentAuthor">{comment.authorName}</span>
                        <span className="commentTime mono">{isSaved ? getRelativeTime(comment.postedAt) : "Sending…"}</span>
                      </div>

                      {isEditing ? (
                        <form
                          className="commentEdit"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveEdit(comment);
                          }}
                        >
                          <textarea
                            className="commentEditInput"
                            value={editDraft}
                            rows={2}
                            autoFocus
                            disabled={savingEdit}
                            aria-label="Edit comment"
                            onChange={(e) => {
                              setEditDraft(e.target.value);
                              if (editError) setEditError("");
                            }}
                          />
                          {editError && <p className="commentEditError" role="alert">{editError}</p>}
                          <div className="commentEditActions">
                            <button type="button" className="commentCancelBtn" onClick={cancelEdit} disabled={savingEdit}>
                              Cancel
                            </button>
                            <button type="submit" className="commentPostBtn" disabled={!editDraft.trim() || savingEdit}>
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="commentBody">{comment.body}</div>
                      )}
                    </div>

                    {!isEditing && (canEdit || canDelete) && (
                      <PostMenu
                        noun="comment"
                        onEdit={canEdit ? () => startEdit(comment) : undefined}
                        onDelete={canDelete ? () => setDeletingComment(comment) : undefined}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form className="commentForm" onSubmit={submitComment}>
          <CommentAvatar src={currentUser.avatar_path} initials={currentUser.initials} />
          <input
            ref={inputRef}
            type="text"
            className="commentInput"
            placeholder="Write a comment..."
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (commentError) setCommentError("");
            }}
          />
          <button type="submit" className="commentPostBtn sendBtn" disabled={!draft.trim() || submitting}>
            Post
            <SendIcon />
          </button>
        </form>
        {commentError && <p className="commentError" role="alert">{commentError}</p>}
      </div>

      {deletingComment && (
        <ConfirmDialog
          title="Delete this comment?"
          message={
            deletingComment.authorId === currentUser.id
              ? "Your comment will be removed from this post. This can't be undone."
              : `${deletingComment.authorName}'s comment will be removed from this post. This can't be undone.`
          }
          confirmLabel="Delete"
          busyLabel="Deleting..."
          errorMessage="Couldn't delete this comment. Please try again."
          onCancel={() => setDeletingComment(null)}
          onConfirm={async () => {
            await onDeleteComment(announcement.id, deletingComment.id);
            setDeletingComment(null);
          }}
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
          backdrop-filter: blur(3px);
          animation: fadeIn 0.15s ease backwards;
        }

        .modalPanel {
          width: 100%;
          max-width: 560px;
          max-height: 85vh;
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
          padding: 10px 12px 10px 14px;
          background-color: var(--navy);
          /* Same blueprint grid + glow as the site nav. */
          background-image:
            radial-gradient(ellipse 300px 160% at 0% 50%, rgba(46, 92, 138, 0.55), transparent 70%),
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: auto, 16px 16px, 16px 16px;
          border-bottom: 3px solid var(--orange);
          flex-shrink: 0;
        }

        .modalAccent {
          height: 3px;
          background: var(--yellow);
          flex-shrink: 0;
        }

        .modalTopBarTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #c6d3e5;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .modalTopBarIcon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--orange);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .crumbSep {
          color: rgba(198, 211, 229, 0.45);
        }

        .crumbTag {
          color: var(--white);
          padding: 2px 8px;
          border: 1px solid rgba(217, 83, 30, 0.7);
          background: rgba(217, 83, 30, 0.18);
          border-radius: 999px;
          font-size: 10px;
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
          transition: background 0.15s ease, transform 0.2s ease;
        }

        .modalClose:hover {
          background: rgba(255, 255, 255, 0.24);
          transform: rotate(90deg);
        }

        .modalClose:focus-visible {
          outline: 2px solid var(--grid);
          outline-offset: 1px;
        }

        .modalScroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px 22px;
          scrollbar-width: thin;
          scrollbar-color: #c9bfa0 transparent;
        }

        .commentsList {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #c9bfa0;
        }

        .commentsHead {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
          margin-bottom: 10px;
        }

        .commentsHeadIcon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fcebdf;
          color: var(--orange);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .commentsCount {
          color: var(--ink-soft);
          background: var(--vellum);
          border: 1px solid var(--rule-soft);
          padding: 0 7px;
          border-radius: 999px;
          font-size: 10.5px;
        }

        .commentsEmpty {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          font: inherit;
          font-size: 13px;
          color: var(--ink-soft);
          margin: 4px 0;
          padding: 14px 16px;
          background: none;
          border: 1px dashed #c9bfa0;
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .commentsEmpty:hover {
          border-color: var(--orange);
          background: rgba(217, 83, 30, 0.04);
        }

        .commentsEmpty strong {
          color: var(--ink);
          font-weight: 600;
        }

        .commentsEmptyIcon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--vellum);
          color: var(--ink-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .commentItem {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 8px;
          margin: 0 -8px;
          border-radius: 6px;
          animation: fadeInUp 0.25s ease backwards;
          transition: background 0.15s ease;
        }

        .commentItem:hover {
          background: rgba(237, 231, 217, 0.5);
        }

        .commentItem + .commentItem {
          border-top: 1px dashed #d8cfb4;
        }

        .commentItem.sending {
          opacity: 0.6;
        }

        .commentBubble {
          flex: 1;
          min-width: 0;
        }

        .commentMeta {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }

        .commentAuthor {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .commentTime {
          font-size: 10.5px;
          color: var(--ink-soft);
        }

        .commentBody {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
          margin-top: 2px;
          overflow-wrap: anywhere;
        }

        .commentEdit {
          margin-top: 6px;
        }

        .commentEditInput {
          display: block;
          resize: vertical;
          min-height: 56px;
          margin-bottom: 6px !important;
          padding: 8px 10px !important;
          font-size: 13px !important;
          line-height: 1.5;
          box-shadow: none !important;
        }

        .commentEditError {
          font-size: 12px;
          color: var(--orange);
          margin: 0 0 6px;
        }

        .commentEditActions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }

        .commentCancelBtn {
          background: none;
          border: 1px solid #c9bfa0;
          color: var(--ink);
          font-weight: 500;
          font-size: 12.5px;
          cursor: pointer;
          padding: 7px 14px;
          border-radius: 5px;
          transition: background 0.15s ease;
        }

        .commentCancelBtn:hover:not(:disabled) {
          background: var(--vellum-2);
        }

        .commentForm {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 12px 22px;
          background: var(--vellum);
          border-top: 1px solid #c9bfa0;
          flex-shrink: 0;
        }

        .commentInput {
          flex: 1;
          margin-bottom: 0 !important;
          padding: 8px 14px !important;
          border-radius: 999px !important;
          font-size: 13px !important;
          box-shadow: none !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .commentInput:focus {
          outline: none !important;
          border-color: var(--navy) !important;
          box-shadow: 0 0 0 3px rgba(46, 92, 138, 0.15) !important;
        }

        .sendBtn {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 7px 14px 7px 16px;
        }

        .sendBtn:not(:disabled) {
          background: var(--orange);
          border-color: var(--orange);
        }

        .sendBtn:hover:not(:disabled) {
          background: #b84418;
          border-color: #b84418;
        }

        .sendBtn :global(svg) {
          transition: transform 0.2s ease;
        }

        .sendBtn:hover:not(:disabled) :global(svg) {
          transform: translate(2px, -2px);
        }

        .commentPostBtn {
          background: var(--navy);
          border: 1px solid var(--navy);
          color: var(--white);
          font-weight: 600;
          font-size: 12.5px;
          cursor: pointer;
          padding: 7px 14px;
          border-radius: 5px;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.1s ease;
        }

        .commentPostBtn:hover:not(:disabled) {
          background: var(--navy-deep);
          border-color: var(--navy-deep);
        }

        .commentPostBtn:active:not(:disabled) {
          transform: scale(0.94);
        }

        .commentError {
          margin: 0;
          padding: 0 22px 12px;
          font-size: 12px;
          color: #b3261e;
          background: var(--vellum);
        }

        .commentPostBtn:disabled {
          background: var(--white);
          border-color: #c9bfa0;
          color: var(--ink-soft);
          cursor: not-allowed;
        }

        @media (prefers-reduced-motion: reduce) {
          .modalClose:hover {
            transform: none;
          }

          .commentItem {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
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

// Styled with Tailwind rather than the styled-jsx block above: styled-jsx
// scopes classes per component, so they wouldn't reach this one.
function CommentAvatar({ src, initials }: { src: string; initials: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-full border border-navy-tint object-cover"
      />
    );
  }

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy font-display text-[11px] font-semibold text-paper">
      {initials}
    </span>
  );
}
