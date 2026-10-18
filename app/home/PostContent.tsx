"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import MediaGrid from "./MediaGrid";
import ImageLightbox from "./ImageLightbox";
import RichTextBody from "./RichTextBody";
import PostMenu from "./PostMenu";
import { type Announcement, type User, getPerson, getRelativeTime } from "@/app/home/HomeContent";

type Reactor = {
  id: string;
  name: string;
  initials: string;
  avatar: string;
  isYou: boolean;
};

/** Faces shown stacked next to the heart before the count. */
const FACEPILE_MAX = 3;

async function loadReactors(reactedBy: string[], currentUser: User): Promise<Reactor[]> {
  const reactors = await Promise.all(
    reactedBy.map(async (id): Promise<Reactor> => {
      if (id === currentUser.id) {
        return { id, name: currentUser.name, initials: currentUser.initials, avatar: currentUser.avatar_path, isYou: true };
      }
      try {
        const person = await getPerson(id);
        return { id, name: person.name || "Unknown", initials: person.initials || "?", avatar: person.avatar_path, isYou: false };
      } catch {
        return { id, name: "Unknown", initials: "?", avatar: "", isYou: false };
      }
    })
  );
  // You first, everyone else in the order they reacted.
  return reactors.sort((a, b) => Number(b.isYou) - Number(a.isYou));
}

export default function PostContent({
  announcement,
  currentUser,
  onToggleReaction,
  onCommentClick,
  authorOverride,
  collapsible = false,
  hideAuthor = false,
  hideActions = false,
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
  // Hide the author header (e.g. modal left pane — author lives in the side column).
  hideAuthor?: boolean;
  // Hide the heart / comment action row (e.g. modal left pane).
  hideActions?: boolean;
  // Shown in the "..." menu; omit both to hide the menu (e.g. not the author).
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [showReactors, setShowReactors] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const reactorsRef = useRef<HTMLDivElement>(null);
  // Counts reactions made here, so the burst plays on a click but not when the page loads.
  const [heartBursts, setHeartBursts] = useState(0);

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

  useEffect(() => {
    let active = true;
    loadReactors(announcement.reactedBy, currentUser).then((resolved) => {
      if (active) setReactors(resolved);
    });

    return () => {
      active = false;
    };
  }, [announcement.reactedBy, currentUser]);

  useEffect(() => {
    if (!showReactors) return;

    function onDocMouseDown(e: MouseEvent) {
      if (reactorsRef.current && !reactorsRef.current.contains(e.target as Node)) setShowReactors(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowReactors(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showReactors]);

  // Last reactor left: close the list instead of leaving an empty card open.
  const reactorsOpen = showReactors && reactors.length > 0;

  return (
    <div className="postContent">
      {!hideAuthor && (
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
      )}

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

      {!hideActions && (
      <div className="postActions">
        <div className="actionGroup">
          <button
            type="button"
            className={`actionBtn heartBtn ${reacted ? "active" : ""}`}
            onClick={() => {
              if (!reacted) setHeartBursts((count) => count + 1);
              onToggleReaction(announcement.id);
            }}
            aria-label={reacted ? "Remove reaction" : "React"}
          >
            {/* Keyed by burst count so each new reaction replays the pop. */}
            <span key={heartBursts} className={`heartWrap${heartBursts > 0 && reacted ? " pop" : ""}`}>
              <HeartIcon filled={reacted} />
            </span>
            {heartBursts > 0 && reacted && (
              <span key={`burst-${heartBursts}`} className="heartBurst" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
          </button>
          {reactors.length > 0 && (
            <div className="countWrap" ref={reactorsRef}>
              <button
                type="button"
                className={`countBtn faceBtn ${reactorsOpen ? "open" : ""}`}
                onClick={() => setShowReactors((v) => !v)}
                aria-label={`See who reacted (${reactors.length})`}
                aria-expanded={reactorsOpen}
              >
                <span className="facepile" aria-hidden="true">
                  {reactors.slice(0, FACEPILE_MAX).map((reactor) => (
                    <ReactorAvatar key={reactor.id} reactor={reactor} size={20} />
                  ))}
                </span>
                {reactors.length}
              </button>
              {reactorsOpen && (
                <div className="reactorPopover" role="dialog" aria-label="People who reacted">
                  <div className="reactorHead">
                    <span className="reactorHeadIcon">
                      <HeartIcon filled size={11} />
                    </span>
                    <span className="mono reactorHeadLabel">Reactions</span>
                    <span className="mono reactorHeadCount">{reactors.length}</span>
                  </div>
                  <ul className="reactorList">
                    {reactors.map((reactor, index) => (
                      <li key={reactor.id} className="reactorRow" style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}>
                        <span className="reactorFace">
                          <ReactorAvatar reactor={reactor} size={28} />
                          <span className="reactorBadge" aria-hidden="true">
                            <HeartIcon filled size={7} />
                          </span>
                        </span>
                        <span className="reactorName">{reactor.name}</span>
                        {reactor.isYou && <span className="mono youTag">You</span>}
                      </li>
                    ))}
                  </ul>
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
      )}

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
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid #c9bfa0;
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

        .faceBtn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 2px 8px 2px 3px;
          border-radius: 999px;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .faceBtn:hover,
        .faceBtn.open {
          text-decoration: none;
          background: var(--vellum-2);
          color: var(--navy);
        }

        .facepile {
          display: flex;
        }

        .facepile > :global(*) {
          box-shadow: 0 0 0 2px var(--white);
          transition: margin 0.2s ease;
        }

        .facepile > :global(* + *) {
          margin-left: -7px;
        }

        /* Fan the faces out a little on hover. */
        .faceBtn:hover .facepile > :global(* + *),
        .faceBtn.open .facepile > :global(* + *) {
          margin-left: -3px;
        }

        .reactorPopover {
          position: absolute;
          bottom: calc(100% + 10px);
          left: -6px;
          width: 240px;
          background: var(--white);
          color: var(--ink);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 14px 32px rgba(13, 30, 56, 0.2);
          z-index: 5;
          transform-origin: bottom left;
          animation: popIn 0.15s ease backwards;
        }

        /* Little pointer down at the count. */
        .reactorPopover::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 18px;
          width: 10px;
          height: 10px;
          margin-top: -5px;
          background: var(--white);
          border-right: 1px solid #c9bfa0;
          border-bottom: 1px solid #c9bfa0;
          transform: rotate(45deg);
        }

        .reactorHead {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-bottom: 1px solid #e4dcc9;
        }

        .reactorHeadIcon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fcebdf;
          color: var(--orange);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reactorHeadLabel {
          flex: 1;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
        }

        .reactorHeadCount {
          font-size: 10.5px;
          color: var(--ink-soft);
          background: var(--vellum);
          padding: 1px 7px;
          border-radius: 999px;
        }

        .reactorList {
          list-style: none;
          margin: 0;
          padding: 4px;
          max-height: 232px;
          overflow-y: auto;
        }

        .reactorRow {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px;
          border-radius: 6px;
          animation: fadeIn 0.2s ease backwards;
          transition: background 0.15s ease;
        }

        .reactorRow:hover {
          background: var(--vellum);
        }

        .reactorFace {
          position: relative;
          display: flex;
          flex-shrink: 0;
        }

        .reactorBadge {
          position: absolute;
          right: -3px;
          bottom: -3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--orange);
          color: var(--white);
          border: 2px solid var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reactorName {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .youTag {
          font-size: 9.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--orange);
          border: 1px solid rgba(217, 83, 30, 0.4);
          padding: 0 5px;
          border-radius: 3px;
        }

        .postActions {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid #c9bfa0;
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

        /* ---------- Reaction burst (only when you react, not on load) ---------- */
        .heartBtn {
          position: relative;
        }

        .heartWrap {
          display: flex;
        }

        .heartWrap.pop {
          animation: heartPop 0.45s ease;
        }

        .heartBurst {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        /* A thin ring that swells out and fades. */
        .heartBurst::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 22px;
          height: 22px;
          margin: -11px 0 0 -11px;
          border-radius: 50%;
          border: 2px solid var(--orange);
          opacity: 0;
          animation: heartRing 0.5s ease-out;
        }

        .heartBurst i {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4px;
          height: 4px;
          margin: -2px 0 0 -2px;
          border-radius: 50%;
          background: var(--orange);
          opacity: 0;
          animation: heartDot 0.5s ease-out;
        }

        .heartBurst i:nth-child(1) { --a: 0deg; }
        .heartBurst i:nth-child(2) { --a: 60deg; background: var(--yellow); }
        .heartBurst i:nth-child(3) { --a: 120deg; }
        .heartBurst i:nth-child(4) { --a: 180deg; background: var(--yellow); }
        .heartBurst i:nth-child(5) { --a: 240deg; }
        .heartBurst i:nth-child(6) { --a: 300deg; background: var(--yellow); }

        @keyframes heartRing {
          0% {
            transform: scale(0.3);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes heartDot {
          0% {
            transform: rotate(var(--a)) translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--a)) translateY(-15px) scale(0.4);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .heartWrap.pop {
            animation: none;
          }

          .heartBurst {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function ReactorAvatar({ reactor, size }: { reactor: Reactor; size: number }) {
  if (reactor.avatar) {
    return (
      <Image
        src={reactor.avatar}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-navy-tint object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-navy font-display font-semibold text-paper"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {reactor.initials}
    </span>
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
