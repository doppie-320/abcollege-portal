"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Flag, Pencil, Trash2, VenetianMask } from "lucide-react";
import { CATEGORY_LABELS, formatRelative, type Suggestion } from "@/lib/suggestions";
import { AuthorAvatar, CategoryIcon, toneClass } from "./ui";

type Props = {
  suggestion: Suggestion;
  isOwn: boolean;
  isAdmin: boolean;
  /** Still being saved; actions wait until it settles. */
  pending: boolean;
  /** Just saved: "new" plays a bold highlight, "edit" a quiet one. */
  flash: "new" | "edit" | null;
  /** Position in the list, for the staggered entrance. */
  index: number;
  onEdit: (suggestion: Suggestion) => void;
  onDelete: (suggestion: Suggestion) => void;
};

export default function SuggestionCard({ suggestion, isOwn, isAdmin, pending, flash, index, onEdit, onDelete }: Props) {
  const { category, title, body, anonymous, author, createdAt, updatedAt } = suggestion;
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Only offer "Read more" when the clamp is actually hiding something; recheck on resize.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [body, expanded]);

  const who = isOwn ? "You" : anonymous || !author ? "Anonymous student" : author.name;
  const classes = ["sgCard", toneClass(category)];
  if (pending) classes.push("isPending");
  if (flash === "new") classes.push("isFlash");
  if (isOwn && isAdmin) classes.push("isMine");

  return (
    <article
      className={classes.join(" ")}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms`, "--tilt": `${index % 2 ? 2.5 : -2.5}deg` } as CSSProperties}
      aria-busy={pending}
      aria-label={title}
    >
      {flash === "edit" && <span className="sgSaved" aria-hidden="true" />}
      <span className="sgTape" aria-hidden="true" />

      <header className="sgCardHead">
        <span className="sgChip">
          <CategoryIcon category={category} size={13} />
          {CATEGORY_LABELS[category]}
        </span>
        <time className="mono sgTime" dateTime={createdAt} title={new Date(createdAt).toLocaleString()} suppressHydrationWarning>
          {pending ? "saving…" : formatRelative(createdAt)}
          {updatedAt && !pending && <span className="sgEdited"> · edited</span>}
        </time>
      </header>

      <div className="sgContent">
        <h3 className="sgTitle">{title}</h3>
        <p ref={bodyRef} className={`sgBody${expanded ? " isExpanded" : ""}`}>
          {body}
        </p>
        {(overflows || expanded) && (
          <button type="button" className="sgMore" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      <footer className="sgCardFoot">
        <div className="sgWho">
          <AuthorAvatar author={author} anonymous={anonymous} />
          <span className="sgWhoText">
            <span className="sgWhoName">{who}</span>
            {anonymous && (
              <span className="mono sgAnonBadge" title={isOwn ? "The council sees this as an anonymous student" : undefined}>
                <VenetianMask size={11} strokeWidth={2.2} aria-hidden="true" />
                {isOwn ? "Hidden from council" : "Anonymous"}
              </span>
            )}
          </span>
        </div>

        <div className="sgActions">
          {isOwn ? (
            <>
              <button
                type="button"
                className="sgIconBtn"
                onClick={() => onEdit(suggestion)}
                disabled={pending}
                aria-label={`Edit "${title}"`}
                title="Edit"
              >
                <Pencil size={15} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="sgIconBtn isDanger"
                onClick={() => onDelete(suggestion)}
                disabled={pending}
                aria-label={`Delete "${title}"`}
                title="Delete"
              >
                <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </>
          ) : (
            isAdmin && (
              <button
                type="button"
                className="sgRemoveBtn"
                onClick={() => onDelete(suggestion)}
                disabled={pending}
                aria-label={`Remove "${title}" as inappropriate`}
              >
                <Flag size={13} strokeWidth={2.2} aria-hidden="true" />
                <span className="sgRemoveLabel">Remove</span>
              </button>
            )
          )}
        </div>
      </footer>

      <style jsx>{`
        .sgCard {
          position: relative;
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 20px 18px 0;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          box-shadow: 0 1px 0 rgba(13, 30, 56, 0.04), 0 10px 24px -18px rgba(13, 30, 56, 0.4);
          animation: sgCardIn 0.42s cubic-bezier(0.34, 1.3, 0.64, 1) backwards;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        @keyframes sgCardIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
        }

        /* Category colour along the top edge, like a coloured index card. */
        .sgCard::before {
          content: "";
          position: absolute;
          left: -1px;
          right: -1px;
          top: -1px;
          height: 4px;
          border-radius: 8px 8px 0 0;
          background: var(--sg-tone);
        }

        .sgCard:hover {
          transform: translate(-2px, -2px);
          border-color: var(--sg-tone);
          box-shadow: 4px 4px 0 var(--sg-tone);
        }

        .sgCard:focus-within {
          border-color: var(--sg-tone);
        }

        /* A strip of masking tape pinning the note to the board. */
        .sgTape {
          position: absolute;
          top: -9px;
          left: 50%;
          width: 58px;
          height: 16px;
          background: rgba(253, 247, 1, 0.55);
          border-left: 1px dashed rgba(28, 35, 51, 0.12);
          border-right: 1px dashed rgba(28, 35, 51, 0.12);
          box-shadow: 0 1px 2px rgba(13, 30, 56, 0.12);
          transform: translateX(-50%) rotate(var(--tilt));
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        }

        .sgCard:hover .sgTape {
          transform: translateX(-50%) rotate(calc(var(--tilt) * -1.4)) translateY(-1px);
        }

        .sgCard.isMine .sgTape {
          background: rgba(217, 83, 30, 0.35);
        }

        .sgCard.isFlash {
          animation: sgCardIn 0.42s cubic-bezier(0.34, 1.3, 0.64, 1) backwards, sgFlash 1.4s ease-out 0.15s;
        }

        /* After an edit: a soft wash of the category colour that fades out. It's an overlay,
           so the card's own entrance animation is left alone. */
        .sgSaved {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: var(--sg-tint);
          pointer-events: none;
          animation: sgSaved 0.9s ease-out forwards;
        }

        /* Positioned, so they paint above the wash instead of under it. */
        .sgCardHead,
        .sgContent,
        .sgCardFoot {
          position: relative;
        }

        @keyframes sgSaved {
          from {
            opacity: 0.85;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes sgFlash {
          0% {
            box-shadow: 0 0 0 0 rgba(253, 247, 1, 0), 0 0 0 0 var(--sg-tone);
          }
          20% {
            box-shadow: 0 0 0 6px rgba(253, 247, 1, 0.75), 0 0 0 8px var(--sg-tone);
          }
          100% {
            box-shadow: 0 0 0 14px rgba(253, 247, 1, 0), 0 0 0 16px transparent;
          }
        }

        .sgCard.isPending {
          opacity: 0.75;
        }

        /* A sliding stripe along the bottom while the save is in flight. */
        .sgCard.isPending::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 3px;
          border-radius: 0 0 8px 8px;
          background: repeating-linear-gradient(90deg, var(--sg-tone) 0 14px, transparent 14px 28px);
          background-size: 28px 3px;
          animation: sgStripe 0.6s linear infinite;
        }

        @keyframes sgStripe {
          to {
            background-position: 28px 0;
          }
        }

        .sgCardHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .sgChip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px 3px 6px;
          border-radius: 4px;
          background: var(--sg-tint);
          color: var(--sg-tone);
          font-family: "IBM Plex Mono", monospace;
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .sgTime {
          font-size: 10.5px;
          color: var(--ink-soft);
          white-space: nowrap;
        }

        .sgEdited {
          font-style: italic;
        }

        .sgTitle {
          margin: 0 0 6px;
          font-size: 17px;
          line-height: 1.3;
          color: var(--navy-deep);
          overflow-wrap: anywhere;
        }

        .sgBody {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--ink-soft);
          white-space: pre-line;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
          line-clamp: 4;
          overflow: hidden;
        }

        .sgBody.isExpanded {
          display: block;
          -webkit-line-clamp: unset;
          line-clamp: none;
          overflow: visible;
        }

        .sgMore {
          align-self: flex-start;
          margin-top: 4px;
          padding: 0;
          border: none;
          background: none;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--blue);
          cursor: pointer;
        }

        .sgMore:hover {
          color: var(--navy);
          text-decoration: underline;
        }

        .sgMore:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
          border-radius: 2px;
        }

        .sgCardFoot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: auto;
          padding: 12px 0 12px;
          border-top: 1px dashed var(--rule-soft);
        }

        /* Keeps a gap above the footer, which itself sinks to the bottom of taller rows. */
        .sgContent {
          display: flex;
          flex-direction: column;
          padding-bottom: 14px;
        }

        .sgWho {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .sgWhoText {
          display: flex;
          flex-direction: column;
          min-width: 0;
          line-height: 1.25;
        }

        .sgWhoName {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sgAnonBadge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
          white-space: nowrap;
        }

        .sgActions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .sgIconBtn {
          display: flex;
          padding: 7px;
          border: none;
          border-radius: 5px;
          background: none;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
        }

        .sgIconBtn:hover:not(:disabled) {
          background: var(--vellum);
          color: var(--navy);
        }

        .sgIconBtn.isDanger:hover:not(:disabled) {
          background: #fbe9e7;
          color: #b3261e;
        }

        .sgIconBtn:active:not(:disabled) {
          transform: scale(0.9);
        }

        .sgIconBtn:disabled,
        .sgRemoveBtn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .sgIconBtn:focus-visible,
        .sgRemoveBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }

        .sgRemoveBtn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 10px;
          border: 1px solid rgba(179, 38, 30, 0.35);
          border-radius: 5px;
          background: var(--white);
          color: #b3261e;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .sgRemoveBtn:hover:not(:disabled) {
          background: #fbe9e7;
          border-color: #b3261e;
          transform: translate(-1px, -1px);
          box-shadow: 2px 2px 0 #b3261e;
        }

        .sgRemoveBtn:active:not(:disabled) {
          transform: none;
          box-shadow: none;
        }

        @media (max-width: 520px) {
          .sgCard {
            padding: 18px 14px 0;
          }

          .sgTitle {
            font-size: 16px;
          }

          /* Bigger touch targets on phones. */
          .sgIconBtn {
            padding: 9px;
          }

          .sgRemoveBtn {
            height: 34px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sgSaved {
            display: none;
          }

          .sgCard,
          .sgCard.isFlash,
          .sgCard.isPending::after {
            animation: none;
          }

          .sgCard,
          .sgTape,
          .sgIconBtn,
          .sgRemoveBtn {
            transition: none;
          }
        }
      `}</style>
    </article>
  );
}
