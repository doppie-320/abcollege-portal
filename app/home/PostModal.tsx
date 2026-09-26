"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import PostContent from "./PostContent";
import { getRelativeTime, type Announcement, type User } from "@/app/home/HomeContent";

export default function PostModal({
  announcement,
  currentUser,
  onToggleReaction,
  onClose,
  onAddComment,
}: {
  announcement: Announcement;
  currentUser: User;
  onToggleReaction: (postId: string) => void;
  onClose: () => void;
  onAddComment: (postId: string, body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

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
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modalTopBar">
          <span className="modalTopBarTitle mono">
            ANNOUNCEMENT{announcement.tag ? ` / ${announcement.tag.toUpperCase()}` : ""}
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
              Comments <span className="commentsCount">{commentCount}</span>
            </div>
            {commentCount === 0 ? (
              <p className="commentsEmpty">No comments yet. Be the first to reply.</p>
            ) : (
              announcement.comments.map((comment) => (
                <div className="commentItem" key={comment.id}>
                  <span className="avatar avatarSm">{comment.authorInitials}</span>
                  <div className="commentBubble">
                    <div className="commentMeta">
                      <span className="commentAuthor">{comment.authorName}</span>
                      <span className="commentTime mono">{getRelativeTime(comment.postedAt)}</span>
                    </div>
                    <div className="commentBody">{comment.body}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <form className="commentForm" onSubmit={submitComment}>
          <span className="avatar avatarSm">{currentUser.initials}</span>
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
          <button type="submit" className="commentPostBtn" disabled={!draft.trim() || submitting}>
            Post
          </button>
        </form>
        {commentError && <p className="commentError" role="alert">{commentError}</p>}
      </div>

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

        .modalScroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px 22px;
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
          margin-bottom: 6px;
        }

        .commentsCount {
          color: var(--ink-soft);
        }

        .commentsEmpty {
          font-size: 13px;
          color: var(--ink-soft);
          margin: 8px 0 4px;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          font-size: 13px;
          flex-shrink: 0;
        }

        .avatarSm {
          width: 28px;
          height: 28px;
          font-size: 11px;
        }

        .commentItem {
          display: flex;
          gap: 10px;
          padding: 10px 0;
        }

        .commentItem + .commentItem {
          border-top: 1px dashed #d8cfb4;
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
          padding: 8px 12px !important;
          border-radius: 5px !important;
          font-size: 13px !important;
          box-shadow: none !important;
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
      `}</style>
    </div>
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
