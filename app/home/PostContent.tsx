"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import MediaGrid from "./MediaGrid";
import ImageLightbox from "./ImageLightbox";
import RichTextBody from "./RichTextBody";
import PostMenu from "./PostMenu";
import { type Announcement, type User, getPerson, getRelativeTime } from "@/app/home/HomeContent";

// The current user is listed first, as "You".
async function loadReactors(reactedBy: string[], currentUser: User): Promise<User[]> {
  const others = await Promise.all(reactedBy.filter((id) => id !== currentUser.id).map((id) => getPerson(id)));
  return reactedBy.includes(currentUser.id) ? [{ ...currentUser, name: "You" }, ...others] : others;
}

export default function PostContent({
  announcement,
  currentUser,
  onToggleReaction,
  onCommentClick,
  authorOverride,
  collapsible = false,
  onEdit,
  onDelete,
}: {
  announcement: Announcement;
  currentUser: User;
  onToggleReaction: (postId: string) => void;
  onCommentClick: () => void;
  // Known author (e.g. the Create post preview); skips the author lookup.
  authorOverride?: User;
  // Clip long bodies behind "Show more" (feed cards, not the full post view).
  collapsible?: boolean;
  // Shown in the "..." menu; omit both to hide the menu (e.g. not the author).
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [showReactors, setShowReactors] = useState(false);
  const reactorsRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reactors, setReactors] = useState<User[]>([]);

  const [fetchedAuthor, setAuthor] = useState<User | null>(null);
  const author = authorOverride ?? fetchedAuthor;
  const reacted = announcement.reactedBy.includes(currentUser.id);

  useEffect(() => {
    // Posts with no author_id keep the "Unknown" fallback.
    if (authorOverride || !announcement.authorId) return;
    let active = true;
    getPerson(announcement.authorId)
      .then((resolvedAuthor) => {
        if (active) setAuthor(resolvedAuthor);
      })
      .catch((error) => console.error("Error fetching announcement author:", error));

    return () => {
      active = false;
    };
  }, [announcement.authorId, authorOverride]);

  // Close the "who reacted" popover on any click outside it, or Escape.
  useEffect(() => {
    if (!showReactors) return;

    function onDocClick(e: MouseEvent) {
      if (reactorsRef.current && !reactorsRef.current.contains(e.target as Node)) setShowReactors(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowReactors(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showReactors]);

  useEffect(() => {
    let active = true;
    loadReactors(announcement.reactedBy, currentUser)
      .then((resolved) => {
        if (active) setReactors(resolved);
      })
      .catch((error) => console.error("Error fetching reactors:", error));

    return () => {
      active = false;
    };
  }, [announcement.reactedBy, currentUser]);

  return (
    <div className="postContent">
      <div className="postHeader">
        {author?.avatar_path ? (
          <Image
            src={author.avatar_path}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-full border border-navy-tint object-cover"
          />
        ) : (
          <span className="avatar">{author?.initials ?? "?"}</span>
        )}
        <div className="postHeaderText">
          <div className="postAuthorName">{author?.name ?? "Unknown"}</div>
          <div className="postMetaLine">
            {author?.isAdmin?.role && <span className="postAuthorRole">{author.isAdmin.role}</span>}
            <span className="mono postTime">POSTED {getRelativeTime(announcement.postedAt).toUpperCase()}</span>
            {announcement.tag && <span className="tag postTag">{announcement.tag}</span>}
          </div>
        </div>
        {onEdit && onDelete && <PostMenu onEdit={onEdit} onDelete={onDelete} />}
      </div>

      <h3 className="postTitle">{announcement.title}</h3>
      <RichTextBody content={announcement.body} collapsible={collapsible} />

      {announcement.media && (
        <div className="media">
          {announcement.media.type === "image" ? (
            <MediaGrid items={announcement.media.items} onOpen={(i) => setLightboxIndex(i)} />
          ) : (
            <div className="videoPlaceholder">
              <span className="playButton">
                <PlayIcon />
              </span>
              <span className="videoLabel">{announcement.media.label}</span>
              <span className="videoDuration mono">{announcement.media.duration}</span>
            </div>
          )}
        </div>
      )}

      {announcement.media?.type === "image" && lightboxIndex !== null && (
        <ImageLightbox
          items={announcement.media.items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

      {/* Each action is a pill chip; empty ones show a verb, the rest show their count. */}
      <div className="postActions">
        <div className={`chip ${reacted ? "active" : ""}`}>
          <button
            type="button"
            className="actionBtn"
            onClick={() => onToggleReaction(announcement.id)}
            aria-label={reacted ? "Remove reaction" : "React"}
          >
            <HeartIcon filled={reacted} />
            {announcement.reactedBy.length === 0 && <span className="chipLabel">Like</span>}
          </button>
          {/* Count from reactedBy, not the looked-up names, so it changes with the heart. */}
          {announcement.reactedBy.length > 0 && (
            <div className="countWrap" ref={reactorsRef}>
              <button
                type="button"
                className="countBtn"
                onClick={() => setShowReactors((v) => !v)}
                aria-label="See who reacted"
              >
                {announcement.reactedBy.length}
              </button>
              {showReactors && (
                <div className="reactorPopover" role="dialog" aria-label="People who reacted">
                  <div className="reactorHead">
                    <HeartIcon filled size={11} />
                    Reacted · {announcement.reactedBy.length}
                  </div>
                  {/* Names load in the background; count from reactedBy so it's right immediately. */}
                  {reactors.length === 0 ? (
                    <div className="reactorEmpty">Loading…</div>
                  ) : (
                    <ul className="reactorList">
                      {reactors.map((person) => (
                        <li key={person.id} className="reactorRow">
                          {person.avatar_path ? (
                            <Image
                              src={person.avatar_path}
                              alt=""
                              width={24}
                              height={24}
                              className="size-6 shrink-0 rounded-full border border-navy-tint object-cover"
                            />
                          ) : (
                            <span className="reactorAvatar">{person.initials || "?"}</span>
                          )}
                          <span className={`reactorName${person.id === currentUser.id ? " isYou" : ""}`}>
                            {person.name || "Unknown"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="chip actionBtn"
          onClick={onCommentClick}
          aria-label={`Comment (${announcement.comments.length})`}
        >
          <CommentIcon />
          <span className="chipLabel">{announcement.comments.length || "Comment"}</span>
        </button>
      </div>

      <style jsx>{`
        .postTitle {
          font-size: 24px;
          line-height: 1.25;
          margin-bottom: 14px;
          overflow-wrap: anywhere;
        }

        .postHeader {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
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

        .postTag {
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-radius: 3px;
          font-size: 9.5px;
          padding: 1px 6px;
        }

        .postHeaderText {
          flex: 1;
          min-width: 0;
        }

        .postAuthorName {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .postMetaLine {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 1px;
          flex-wrap: wrap;
        }

        .postAuthorRole {
          font-size: 11.5px;
          color: var(--ink-soft);
        }

        .postTime {
          font-size: 11px;
          color: var(--ink-soft);
        }

        .media {
          margin-top: 14px;
          border: 1px solid #c9bfa0;
          background: var(--vellum);
          overflow: hidden;
          border-radius: 6px;
        }

        .videoPlaceholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 16px;
        }

        .playButton {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .videoLabel {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }

        .videoDuration {
          font-size: 11.5px;
          color: var(--ink-soft);
        }

        .countWrap {
          position: relative;
        }

        .countBtn {
          background: none;
          border: none;
          padding: 0;
          color: inherit;
          font: inherit;
          cursor: pointer;
        }

        .countBtn:hover {
          text-decoration: underline;
        }

        /* Popover sits above the chip, offset to line up with the chip's left edge. */
        .reactorPopover {
          position: absolute;
          bottom: 100%;
          left: -32px;
          margin-bottom: 12px;
          min-width: 190px;
          max-width: 260px;
          background: var(--white);
          border: 1px solid var(--navy);
          border-radius: 6px;
          box-shadow: 3px 3px 0 var(--orange), 6px 6px 0 var(--yellow);
          cursor: default;
          z-index: 5;
          transform-origin: bottom left;
          animation: popIn 0.15s ease backwards;
        }

        .reactorHead {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--vellum);
          border-radius: 5px 5px 0 0;
          color: var(--orange);
          font-family: "IBM Plex Mono", monospace;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .reactorList {
          list-style: none;
          margin: 0;
          padding: 6px 0;
          max-height: 220px;
          overflow-y: auto;
        }

        .reactorRow {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 5px 12px;
        }

        .reactorAvatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          font-size: 10px;
          flex-shrink: 0;
        }

        .reactorName {
          font-family: "Inter", sans-serif;
          font-size: 13px;
          color: var(--ink);
          letter-spacing: 0;
          text-transform: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reactorName.isYou {
          font-weight: 600;
        }

        .reactorEmpty {
          padding: 10px 12px;
          font-size: 12px;
          color: var(--ink-soft);
        }

        .postActions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 18px;
        }

        /* Bare button reset; .chip (below) adds the pill around it. */
        .actionBtn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          padding: 0;
          color: inherit;
          font: inherit;
          cursor: pointer;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border: 1px solid #c9bfa0;
          border-radius: 999px;
          background: var(--white);
          color: var(--ink-soft);
          font-family: "IBM Plex Mono", monospace;
          font-size: 11.5px;
          line-height: 1;
          transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .chip:hover {
          border-color: var(--navy);
          color: var(--navy);
          transform: translate(-1px, -1px);
          box-shadow: 2px 2px 0 var(--orange);
        }

        .chip:active {
          transform: none;
          box-shadow: none;
        }

        .chip.active {
          border-color: var(--orange);
          color: var(--orange);
          background: color-mix(in srgb, var(--orange) 8%, var(--white));
        }

        .chip.active:hover {
          box-shadow: 2px 2px 0 var(--navy);
        }

        .chip.active svg {
          animation: heartPop 0.4s ease;
        }

        .chipLabel {
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .actionBtn:focus-visible,
        .countBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 3px;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}

function HeartIcon({ filled, size = 15 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 21s-7.5-4.6-10-9.1C.4 8.2 2 4.5 5.6 4a5 5 0 0 1 6.4 2.3A5 5 0 0 1 18.4 4c3.6.5 5.2 4.2 3.6 7.9C19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
