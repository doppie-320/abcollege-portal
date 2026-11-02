"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ShieldCheck, VenetianMask, X } from "lucide-react";
import SheetHandle from "@/components/SheetHandle";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import { useSheetDrag } from "@/lib/useSheetDrag";
import {
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  SUGGESTION_CATEGORIES,
  validateSuggestion,
  type Suggestion,
  type SuggestionAuthor,
  type SuggestionCategory,
  type SuggestionInput,
} from "@/lib/suggestions";
import { AuthorAvatar, CategoryIcon, toneClass } from "./ui";

type Props = {
  /** The suggestion being edited; omit to write a new one. */
  suggestion?: Suggestion;
  /** What they had typed, when the modal reopens after a failed save. */
  draft?: SuggestionInput;
  initialError?: string;
  viewer: SuggestionAuthor;
  onClose: () => void;
  /** Called with checked input, then the modal closes; the page reopens it with the draft if saving fails. */
  onSave: (input: SuggestionInput) => void;
};

const CLOSE_MS = 250;

export default function SuggestionModal({ suggestion, draft, initialError = "", viewer, onClose, onSave }: Props) {
  const isEdit = Boolean(suggestion);
  const [category, setCategory] = useState<SuggestionCategory>(draft?.category ?? suggestion?.category ?? "ACADEMIC");
  const [title, setTitle] = useState(draft?.title ?? suggestion?.title ?? "");
  const [body, setBody] = useState(draft?.body ?? suggestion?.body ?? "");
  const [anonymous, setAnonymous] = useState(draft?.anonymous ?? suggestion?.anonymous ?? false);
  const [error, setError] = useState(initialError);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  const backdrop = useBackdropDismiss(requestClose);
  // Phones and tablets: drag the top bar down to close, up for full screen.
  const sheet = useSheetDrag<HTMLFormElement>({
    onRequestClose: () => !closing,
    onClosed: onClose,
    onHandleClose: requestClose,
  });

  useEffect(() => {
    // Sheets don't autofocus: on phones the keyboard would open mid-slide and fight the animation.
    if (window.matchMedia?.("(min-width: 820px)").matches) titleRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  function clearFieldError(name: string) {
    if (!fieldErrors[name]) return;
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const checked = validateSuggestion({ id: suggestion?.id, category, title, body, anonymous });
    if ("fieldErrors" in checked) {
      setError("Check the highlighted fields.");
      setFieldErrors(checked.fieldErrors);
      return;
    }
    onSave(checked.input);
    onClose();
  }

  // Ctrl/⌘ + Enter sends from the details box, like most chat and comment boxes.
  function onBodyKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const titleLeft = MAX_TITLE_LENGTH - title.length;
  const bodyLeft = MAX_BODY_LENGTH - body.length;

  return (
    <div ref={sheet.backdropRef} className={`sgmBackdrop${closing ? " closing" : ""}`} {...backdrop}>
      <form
        ref={sheet.panelRef}
        className={`sgmPanel ${toneClass(category)}${closing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestionModalHeading"
        noValidate
      >
        <div className="sgmTopBar" {...sheet.zoneProps}>
          <SheetHandle {...sheet.handleProps} />
          <span className="sgmTopBarTitle mono" id="suggestionModalHeading">
            {isEdit ? "EDIT SUGGESTION" : "NEW SUGGESTION"} / {CATEGORY_LABELS[category].toUpperCase()}
          </span>
          <button type="button" className="sgmClose" onClick={requestClose} aria-label="Close">
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="sgmAccent" />

        <div className="sgmBody">
          <fieldset className="sgmField">
            <legend className="sgmLabel">What&apos;s it about?</legend>
            <div className="sgmCats" role="radiogroup" aria-label="Category">
              {SUGGESTION_CATEGORIES.map((value) => {
                const active = value === category;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`sgmCat ${toneClass(value)}${active ? " isActive" : ""}`}
                    onClick={() => {
                      setCategory(value);
                      clearFieldError("category");
                    }}
                  >
                    <span className="sgmCatIcon">
                      <CategoryIcon category={value} size={16} />
                    </span>
                    <span className="sgmCatLabel">{CATEGORY_LABELS[value]}</span>
                  </button>
                );
              })}
            </div>
            <p key={category} className="sgmCatHint">
              {CATEGORY_HINTS[category]}
            </p>
            {fieldErrors.category && <p className="sgmError">{fieldErrors.category}</p>}
          </fieldset>

          <div className="sgmField">
            <div className="sgmLabelRow">
              <label htmlFor="suggestionTitle">Title</label>
              <span className={`mono sgmCount${titleLeft <= 10 ? " isLow" : ""}`} aria-live="polite">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              ref={titleRef}
              id="suggestionTitle"
              type="text"
              className={fieldErrors.title ? "sgmInvalid" : undefined}
              placeholder="e.g. Longer library hours during finals"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError("title");
              }}
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title && <p className="sgmError">{fieldErrors.title}</p>}
          </div>

          <div className="sgmField">
            <div className="sgmLabelRow">
              <label htmlFor="suggestionBody">Details</label>
              <span className={`mono sgmCount${bodyLeft <= 50 ? " isLow" : ""}`}>
                {body.length}/{MAX_BODY_LENGTH}
              </span>
            </div>
            <textarea
              id="suggestionBody"
              className={fieldErrors.body ? "sgmInvalid" : undefined}
              rows={5}
              maxLength={MAX_BODY_LENGTH}
              placeholder="What's the problem, and what would make it better?"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                clearFieldError("body");
              }}
              onKeyDown={onBodyKeyDown}
              aria-invalid={Boolean(fieldErrors.body)}
            />
            {fieldErrors.body && <p className="sgmError">{fieldErrors.body}</p>}
          </div>

          <fieldset className="sgmField">
            <legend className="sgmLabel">Post as</legend>
            <div className="sgmIdentity" role="radiogroup" aria-label="Post as">
              <button
                type="button"
                role="radio"
                aria-checked={!anonymous}
                className={`sgmWho${!anonymous ? " isActive" : ""}`}
                onClick={() => setAnonymous(false)}
              >
                <AuthorAvatar author={viewer} anonymous={false} size={34} />
                <span className="sgmWhoText">
                  <strong>{viewer.name}</strong>
                  <span>The council sees your name</span>
                </span>
                <span className="sgmWhoCheck" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={anonymous}
                className={`sgmWho isAnon${anonymous ? " isActive" : ""}`}
                onClick={() => setAnonymous(true)}
              >
                <AuthorAvatar author={null} anonymous size={34} />
                <span className="sgmWhoText">
                  <strong>Anonymous</strong>
                  <span>Your name stays hidden</span>
                </span>
                <span className="sgmWhoCheck" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>
            </div>
            <p className={`sgmPrivacy${anonymous ? " isAnon" : ""}`}>
              {anonymous ? (
                <>
                  <VenetianMask size={14} strokeWidth={2} aria-hidden="true" />
                  Admins will see &ldquo;Anonymous student&rdquo;. You can still edit or delete it.
                </>
              ) : (
                <>
                  <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
                  Only you and the SOE council can read your suggestions.
                </>
              )}
            </p>
          </fieldset>

          {error && (
            <p className="sgmFormError" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="sgmFooter">
          <span className="sgmHint mono">CTRL + ENTER TO SEND</span>
          <div className="sgmActions">
            <button type="button" className="btn ghost" onClick={requestClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary sgmSubmit">
              {isEdit ? "Save changes" : "Drop it in"}
            </button>
          </div>
        </div>
      </form>

      <style jsx>{`
        .sgmBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(13, 30, 56, 0.55);
          backdrop-filter: blur(3px);
          animation: fadeIn 0.15s ease backwards;
        }

        .sgmBackdrop.closing {
          animation: fadeOut 0.25s ease forwards;
        }

        /* Phones and tablets: a bottom sheet, like the event and comment sheets. */
        .sgmPanel {
          width: 100%;
          max-height: 92vh;
          max-height: 92dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-bottom: none;
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -12px 48px rgba(13, 30, 56, 0.35);
          will-change: transform;
          animation: sgmSheetUp 0.28s cubic-bezier(0.32, 0.9, 0.35, 1) backwards;
        }

        .sgmPanel.closing {
          animation: sgmSheetDown 0.25s cubic-bezier(0.4, 0, 0.4, 1) forwards;
        }

        @keyframes sgmSheetUp {
          from {
            transform: translateY(100%);
          }
        }

        @keyframes sgmSheetDown {
          to {
            transform: translateY(100%);
          }
        }

        @keyframes sgmPopOut {
          to {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
        }

        @media (min-width: 820px) {
          .sgmBackdrop {
            align-items: center;
            padding: 24px;
          }

          .sgmPanel {
            max-width: 560px;
            max-height: calc(100dvh - 48px);
            border-bottom: 1px solid #c9bfa0;
            border-radius: 8px;
            box-shadow: 0 24px 60px rgba(13, 30, 56, 0.35);
            animation: popIn 0.2s ease backwards;
          }

          .sgmPanel.closing {
            animation: sgmPopOut 0.2s ease forwards;
          }
        }

        .sgmTopBar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
          padding: 18px 12px 10px 18px;
          background: var(--navy);
          border-bottom: 3px solid var(--orange);
        }

        /* As a sheet, the handle closes it (tap or drag), so the X steps aside. */
        @media (max-width: 819px) {
          .sgmTopBar {
            padding-bottom: 12px;
          }

          .sgmTopBar .sgmClose {
            display: none;
          }
        }

        @media (min-width: 820px) {
          .sgmTopBar {
            padding-top: 10px;
          }
        }

        .sgmTopBarTitle {
          font-size: 11.5px;
          letter-spacing: 0.08em;
          color: #c6d3e5;
        }

        .sgmAccent {
          height: 3px;
          flex-shrink: 0;
          background: var(--yellow);
        }

        .sgmClose {
          display: flex;
          padding: 5px;
          border: none;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.12);
          color: var(--white);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .sgmClose:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .sgmClose:focus-visible {
          outline: 2px solid var(--grid);
          outline-offset: 1px;
        }

        .sgmBody {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 20px 22px 6px;
          scrollbar-width: thin;
          scrollbar-color: #c9bfa0 transparent;
        }

        .sgmField {
          margin: 0 0 18px;
          padding: 0;
          border: none;
          min-width: 0;
        }

        .sgmLabel {
          display: block;
          padding: 0;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
        }

        .sgmLabelRow {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .sgmCount {
          font-size: 10.5px;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          transition: color 0.15s ease;
        }

        .sgmCount.isLow {
          color: var(--orange);
        }

        .sgmField input[type="text"],
        .sgmField textarea {
          margin-bottom: 0;
        }

        .sgmField textarea {
          resize: vertical;
          min-height: 110px;
          line-height: 1.55;
        }

        .sgmField input[type="text"]:focus,
        .sgmField textarea:focus {
          outline: none;
          border-color: #b9ae92;
          box-shadow: 0 0 0 3px rgba(19, 42, 77, 0.08);
        }

        /* ---------- Category tiles ---------- */
        .sgmCats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .sgmCat {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 4px 9px;
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          background: var(--white);
          color: var(--ink-soft);
          font: inherit;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .sgmCat:hover {
          border-color: var(--sg-tone);
          color: var(--sg-tone);
        }

        .sgmCat.isActive {
          border-color: var(--sg-tone);
          background: var(--sg-tint);
          color: var(--sg-tone);
          font-weight: 600;
          transform: translate(-1px, -1px);
          box-shadow: 2px 2px 0 var(--sg-tone);
        }

        .sgmCat:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .sgmCatIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--sg-tint);
          color: var(--sg-tone);
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease, color 0.15s ease;
        }

        .sgmCat.isActive .sgmCatIcon {
          background: var(--sg-tone);
          color: var(--white);
          transform: scale(1.08) rotate(-8deg);
        }

        .sgmCatLabel {
          white-space: nowrap;
        }

        .sgmCatHint {
          margin: 8px 0 0;
          font-size: 12px;
          color: var(--ink-soft);
          font-style: italic;
          animation: fadeIn 0.25s ease backwards;
        }

        /* ---------- Identity picker ---------- */
        .sgmIdentity {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .sgmWho {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid #c9bfa0;
          border-radius: 8px;
          background: var(--white);
          font: inherit;
          text-align: left;
          color: var(--ink);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }

        .sgmWho:hover {
          border-color: var(--navy);
        }

        .sgmWho.isActive {
          border-color: var(--navy);
          background: #eef3f9;
          box-shadow: inset 0 0 0 1px var(--navy);
        }

        .sgmWho.isAnon.isActive {
          background: var(--navy-deep);
          border-color: var(--navy-deep);
          box-shadow: 3px 3px 0 var(--orange);
          color: var(--white);
        }

        .sgmWho:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .sgmWho.isAnon.isActive :global(.sgAvatar.isMask) {
          background: var(--orange);
          border-color: var(--orange);
          color: var(--white);
          animation: sgmWiggle 0.5s ease;
        }

        @keyframes sgmWiggle {
          0%,
          100% {
            transform: none;
          }
          25% {
            transform: rotate(-14deg) scale(1.1);
          }
          60% {
            transform: rotate(10deg);
          }
        }

        .sgmWhoText {
          display: flex;
          flex-direction: column;
          min-width: 0;
          line-height: 1.3;
        }

        .sgmWhoText strong {
          font-size: 13.5px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sgmWhoText span {
          font-size: 11.5px;
          opacity: 0.75;
        }

        .sgmWhoCheck {
          position: absolute;
          top: -7px;
          right: -7px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--orange);
          color: var(--white);
          border: 2px solid var(--white);
          transform: scale(0);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .sgmWho.isActive .sgmWhoCheck {
          transform: scale(1);
        }

        .sgmPrivacy {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 10px 0 0;
          padding: 8px 12px;
          border-radius: 5px;
          background: var(--vellum);
          border: 1px dashed #c9bfa0;
          font-size: 12.5px;
          line-height: 1.45;
          color: var(--ink-soft);
        }

        .sgmPrivacy :global(svg) {
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--blue);
        }

        .sgmPrivacy.isAnon :global(svg) {
          color: var(--orange);
        }

        .sgmInvalid {
          border-color: #b3261e !important;
        }

        .sgmError {
          margin: 5px 0 0;
          font-size: 12px;
          color: #b3261e;
        }

        .sgmFormError {
          margin: 0 0 14px;
          padding: 8px 12px;
          border-radius: 5px;
          background: #fbe9e7;
          font-size: 12.5px;
          color: #b3261e;
        }

        .sgmFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
          padding: 12px 22px calc(12px + env(safe-area-inset-bottom));
          border-top: 1px solid #c9bfa0;
          background: var(--vellum);
        }

        @media (min-width: 820px) {
          .sgmFooter {
            padding: 12px 22px;
          }
        }

        .sgmHint {
          font-size: 10.5px;
          letter-spacing: 0.08em;
          color: var(--ink-soft);
        }

        .sgmActions {
          display: flex;
          gap: 8px;
        }

        .sgmActions .btn {
          padding: 8px 18px;
          font-size: 13.5px;
        }

        .sgmSubmit {
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .sgmSubmit:hover {
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--navy-deep), 6px 6px 0 var(--yellow);
        }

        .sgmSubmit:active {
          transform: none;
          box-shadow: none;
        }

        /* Touch keyboards have no Ctrl + Enter. */
        @media (hover: none) {
          .sgmHint {
            visibility: hidden;
          }
        }

        /* Narrow sheets: the five category tiles wrap into a 3 + 2 grid. */
        @media (max-width: 640px) {
          .sgmCats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        /* Phone: identity cards stack and the actions fill the footer. */
        @media (max-width: 520px) {
          .sgmBody {
            padding: 16px 16px 4px;
          }

          .sgmFooter {
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          }

          .sgmHint {
            display: none;
          }

          .sgmActions {
            width: 100%;
          }

          .sgmActions .btn {
            flex: 1;
          }

          .sgmIdentity {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sgmPanel,
          .sgmCatHint,
          .sgmWho.isAnon.isActive :global(.sgAvatar.isMask) {
            animation: none;
          }

          .sgmCat,
          .sgmCatIcon,
          .sgmWhoCheck,
          .sgmSubmit {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
