"use client";

import { useEffect, useState } from "react";
import MediaGrid from "./MediaGrid";
import ImageLightbox from "./ImageLightbox";
import RichTextBody from "./RichTextBody";
import PostMenu from "./PostMenu";
import { type Announcement, type User, getPerson, getRelativeTime, getAdmin } from "@/app/home/HomeContent";

async function reactorNames(reactedBy: string[], currentUserId: string): Promise<string[]> {
  const names = await Promise.all(
    reactedBy.map(async (id) => (id === currentUserId ? "You" : (await getPerson(id)).name))
  );
  names.sort((a) => (a === "You" ? -1 : 0));
  return names;
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [names, setNames] = useState<string[]>([]);

  const [fetchedAuthor, setAuthor] = useState<User | null>(null);
  const author = authorOverride ?? fetchedAuthor;
  const reacted = announcement.reactedBy.includes(currentUser.id);

  useEffect(() => {
    if (authorOverride) return;
    let active = true;
    getAdmin(announcement.authorId).then((resolvedAuthor) => {
      if (active) setAuthor(resolvedAuthor);
    });

    return () => {
      active = false;
    };
  }, [announcement.authorId, authorOverride]);

  useEffect(() => {
    let active = true;
    reactorNames(announcement.reactedBy, currentUser.id).then((resolvedNames) => {
      if (active) setNames(resolvedNames);
    });

    return () => {
      active = false;
    };
  }, [announcement.reactedBy, currentUser.id]);

  return (
    <div className="postContent">
      <div className="postHeader">
        <span className="avatar">{author?.initials ?? "?"}</span>
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

      <div className="postActions">
        <div className="actionGroup">
          <button
            type="button"
            className={`actionBtn ${reacted ? "active" : ""}`}
            onClick={() => onToggleReaction(announcement.id)}
            aria-label={reacted ? "Remove reaction" : "React"}
          >
            <HeartIcon filled={reacted} />
          </button>
          {names.length > 0 && (
            <div className="countWrap">
              <button
                type="button"
                className="countBtn"
                onClick={() => setShowReactors((v) => !v)}
                aria-label="See who reacted"
              >
                {names.length}
              </button>
              {showReactors && (
                <div className="reactorPopover">
                  {names.map((name) => (
                    <div key={name}>{name}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="actionGroup">
          <button type="button" className="actionBtn" onClick={onCommentClick} aria-label="Comment">
            <CommentIcon />
          </button>
          {announcement.comments.length > 0 && (
            <button type="button" className="countBtn" onClick={onCommentClick}>
              {announcement.comments.length}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .postTitle {
          font-size: 24px;
          line-height: 1.25;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #d8cfb4;
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
          padding: 2px 4px;
          color: var(--ink-soft);
          font-family: "IBM Plex Mono", monospace;
          font-size: 12px;
          cursor: pointer;
        }

        .countBtn:hover {
          text-decoration: underline;
        }

        .reactorPopover {
          position: absolute;
          bottom: 100%;
          left: 0;
          margin-bottom: 6px;
          background: var(--navy-deep);
          color: var(--white);
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 5px;
          white-space: nowrap;
          z-index: 5;
          transform-origin: bottom left;
          animation: popIn 0.15s ease backwards;
        }

        .postActions {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px dashed #d8cfb4;
        }

        .actionGroup {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .actionBtn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 6px;
          color: var(--ink-soft);
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .actionBtn:hover {
          background: var(--vellum-2);
          color: var(--navy);
        }

        .actionBtn.active:hover {
          color: var(--orange);
        }

        .actionBtn:focus-visible,
        .countBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }

        .actionBtn.active {
          color: var(--orange);
        }

        .actionBtn.active svg {
          animation: heartPop 0.4s ease;
        }
      `}</style>
    </div>
  );
}

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      width={15}
      height={15}
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
