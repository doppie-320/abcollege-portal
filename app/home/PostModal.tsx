"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import PostContent from "./PostContent";
import { formatRelativeTime, getPerson, type Announcement, type Person } from "@/lib/mock/social-db";

export default function PostModal({
  announcement,
  currentUser,
  onToggleReaction,
  onClose,
  onAddComment,
}: {
  announcement: Announcement;
  currentUser: Person;
  onToggleReaction: (postId: string) => void;
  onClose: () => void;
  onAddComment: (postId: string, body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  function submitComment(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddComment(announcement.id, trimmed);
    setDraft("");
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalPanel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modalTopBar">
          <span className="modalTopBarTitle">Post</span>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Close post">
            <CloseIcon />
          </button>
        </div>
        <div className="modalAccent"></div>

        <div className="modalScroll">
          <PostContent
            announcement={announcement}
            currentUser={currentUser}
            onToggleReaction={onToggleReaction}
            onCommentClick={() => inputRef.current?.focus()}
          />

          {announcement.comments.length > 0 && (
            <div className="commentsList">
              {announcement.comments.map((comment) => {
                const author = getPerson(comment.authorId);
                return (
                  <div className="commentItem" key={comment.id}>
                    <span className="avatar avatarSm">{author.initials}</span>
                    <div className="commentBubble">
                      <div className="commentAuthor">{author.name}</div>
                      <div className="commentBody">{comment.body}</div>
                      <div className="commentTime">{formatRelativeTime(comment.postedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form className="commentForm" onSubmit={submitComment}>
          <span className="avatar avatarSm">{currentUser.initials}</span>
          <input
            ref={inputRef}
            type="text"
            className="commentInput"
            placeholder="Write a comment..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="commentPostBtn" disabled={!draft.trim()}>
            Post
          </button>
        </form>
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
          border-radius: 10px;
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
          padding: 8px 18px;
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
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: var(--white);
          letter-spacing: 0.02em;
        }

        .modalClose {
          background: rgba(255, 255, 255, 0.12);
          border: none;
          padding: 6px;
          border-radius: 50%;
          color: var(--white);
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .modalClose:hover {
          background: rgba(255, 255, 255, 0.24);
          transform: scale(1.1) rotate(90deg);
        }

        .modalScroll {
          flex: 1;
          overflow-y: auto;
          padding: 18px;
        }

        .commentsList {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #c9bfa0;
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
          gap: 8px;
          margin-bottom: 14px;
        }

        .commentBubble {
          background: var(--vellum-2);
          border-radius: 12px;
          padding: 8px 12px;
          flex: 1;
        }

        .commentAuthor {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .commentBody {
          font-size: 13px;
          color: var(--ink);
          margin-top: 1px;
        }

        .commentTime {
          font-size: 11px;
          color: var(--ink-soft);
          margin-top: 4px;
        }

        .commentForm {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 14px 18px;
          background: var(--vellum-2);
          border-top: 1px solid #c9bfa0;
          flex-shrink: 0;
        }

        .commentInput {
          flex: 1;
          margin-bottom: 0 !important;
          padding: 8px 12px !important;
          border-radius: 16px !important;
          font-size: 13px !important;
          box-shadow: none !important;
        }

        .commentPostBtn {
          background: var(--orange);
          border: 1px solid var(--orange);
          color: var(--white);
          font-weight: 600;
          font-size: 12.5px;
          cursor: pointer;
          padding: 7px 14px;
          border-radius: 16px;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.1s ease;
        }

        .commentPostBtn:hover:not(:disabled) {
          background: #b84418;
          border-color: #b84418;
        }

        .commentPostBtn:active:not(:disabled) {
          transform: scale(0.94);
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
