"use client";

import { useEffect, useState } from "react";
import MediaGrid from "./MediaGrid";
import ImageLightbox from "./ImageLightbox";
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
  onToggleReaction
}: {
  announcement: Announcement;
  currentUser: User;
  onToggleReaction: (postId: string) => void;
}) {
  const [showReactors, setShowReactors] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [names, setNames] = useState<string[]>([]);

  const [author, setAuthor] = useState<User | null>(null);
  const reacted = announcement.reactedBy.includes(currentUser.id);

  useEffect(() => {
    let active = true;
    getAdmin(announcement.authorId).then((resolvedAuthor) => {
      if (active) setAuthor(resolvedAuthor);
    });

    return () => {
      active = false;
    };
  }, [announcement.authorId]);

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
            <span className="postAuthorRole">{author?.isAdmin?.role}</span>
            <span className="mono postTime">POSTED {getRelativeTime(announcement.postedAt).toUpperCase()}</span>
          </div>
        </div>
      </div>

      <h3>{announcement.title}</h3>
      <p>{announcement.body}</p>

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

      </div>

      <style jsx>{`
        .postContent h3 {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .postContent p {
          font-size: 14px;
          color: var(--ink);
          margin-bottom: 0;
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
          transition: transform 0.15s ease;
        }

        .postHeader:hover .avatar {
          transform: scale(1.08);
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
          margin-top: 12px;
          border: none;
          background: #fbfaf6;
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
          font-size: 12.5px;
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
          gap: 16px;
          margin-top: 12px;
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
          transition: background 0.15s ease, transform 0.15s ease, color 0.15s ease;
        }

        .actionBtn:hover {
          background: var(--vellum-2);
          transform: scale(1.1);
        }

        .actionBtn:active {
          transform: scale(0.9);
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

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
