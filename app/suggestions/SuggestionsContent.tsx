"use client";

import { startTransition, useOptimistic, useState, type FormEvent } from "react";
import Image from "next/image";
import SiteNav from "@/components/NavigationHeader";
import Select from "@/components/Select";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import PostMenu from "@/app/home/PostMenu";
import { settle } from "@/lib/actionResult";
import { formatTimestamp } from "@/lib/dates";
import type { Viewer } from "@/lib/auth";
import {
  deleteSuggestion,
  setSuggestionStatus,
  submitSuggestion,
  updateSuggestion,
  type SuggestionInput,
} from "./actions";

// Keep in sync with MAX_LENGTH in actions.ts.
const MAX_LENGTH = 2000;

type Status = "pending" | "reviewed" | "resolved";

export type Suggestion = {
  id: string;
  content: string;
  isAnonymous: boolean;
  status: Status;
  createdAt: string;
  edited: boolean;
};

export type InboxItem = Suggestion & {
  // null when the author chose to stay anonymous.
  authorName: string | null;
  authorInitials: string;
  authorAvatar: string;
};

const STATUS_STYLES: Record<Status, { label: string; className: string }> = {
  pending: { label: "PENDING", className: "border-[#b8860b] text-[#8a6508]" },
  reviewed: { label: "REVIEWED", className: "border-blue text-blue" },
  resolved: { label: "RESOLVED", className: "border-[#2f7a4f] text-[#2f7a4f]" },
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
];

// Not saved yet: shown faded, with no edit/delete menu.
type OptimisticSuggestion = Suggestion & { pending?: boolean };

type SuggestionChange =
  | { type: "add"; suggestion: OptimisticSuggestion }
  | { type: "edit"; id: string; input: SuggestionInput }
  | { type: "delete"; id: string };

function applySuggestionChange(current: OptimisticSuggestion[], change: SuggestionChange): OptimisticSuggestion[] {
  switch (change.type) {
    case "add":
      // Newest first, same as listMySuggestions.
      return [change.suggestion, ...current];
    case "edit":
      return current.map((s) =>
        s.id === change.id
          ? { ...s, content: change.input.content.trim(), isAnonymous: change.input.isAnonymous, edited: true }
          : s,
      );
    case "delete":
      return current.filter((s) => s.id !== change.id);
  }
}

type SuggestionsContentProps = {
  viewer: Viewer;
  suggestions: Suggestion[];
  // Every student's suggestions; only passed to admins.
  inbox: InboxItem[] | null;
};

export default function SuggestionsContent({ viewer, suggestions, inbox }: SuggestionsContentProps) {
  const [draft, setDraft] = useState<SuggestionInput>({ content: "", isAnonymous: false });
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [draftError, setDraftError] = useState("");

  // `value`/`error` are set when the editor reopens after a failed save.
  const [editing, setEditing] = useState<{ id: string; value?: SuggestionInput; error?: string } | null>(null);
  const [deleting, setDeleting] = useState<Suggestion | null>(null);
  const [listError, setListError] = useState("");

  // Shows sends, edits and deletes right away; resets to the server's list once it refreshes.
  const [mine, applyChange] = useOptimistic<OptimisticSuggestion[], SuggestionChange>(
    suggestions,
    applySuggestionChange,
  );

  function handleCompose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.content.trim()) {
      setDraftError("Write your suggestion first.");
      return;
    }
    setDraftError("");
    setConfirmingSend(true);
  }

  function send() {
    const input = draft;
    setConfirmingSend(false);
    setDraft({ content: "", isAnonymous: false });
    setJustSent(true);
    startTransition(async () => {
      applyChange({
        type: "add",
        suggestion: {
          id: `temp-${crypto.randomUUID()}`,
          content: input.content.trim(),
          isAnonymous: input.isAnonymous,
          status: "pending",
          createdAt: new Date().toISOString(),
          edited: false,
          pending: true,
        },
      });
      const result = await settle(submitSuggestion(input), "Couldn't send your suggestion. Please try again.");
      if (result.error) {
        // Put their text back, unless they've already started a new one.
        setDraft((current) => (current.content ? current : input));
        setJustSent(false);
        setDraftError(result.error);
      }
    });
  }

  function saveEdit(suggestion: Suggestion, value: SuggestionInput) {
    setEditing(null);
    setListError("");
    startTransition(async () => {
      applyChange({ type: "edit", id: suggestion.id, input: value });
      const result = await settle(
        updateSuggestion(suggestion.id, value),
        "Couldn't save your changes. Please try again.",
      );
      // Reopen the editor with what they typed, so nothing is lost.
      if (result.error) setEditing({ id: suggestion.id, value, error: result.error });
    });
  }

  function remove(suggestion: Suggestion) {
    setDeleting(null);
    setListError("");
    startTransition(async () => {
      applyChange({ type: "delete", id: suggestion.id });
      const result = await settle(deleteSuggestion(suggestion.id), "Couldn't delete this suggestion. Please try again.");
      if (result.error) setListError(result.error);
    });
  }

  return (
    <>
      <SiteNav
        initials={viewer.initials}
        name={viewer.name}
        userId={viewer.id}
        avatarUrl={viewer.avatarUrl}
      />

      <div className="page-wrap">
        <div className="mb-6 animate-fade-in-up">
          <span className="eyebrow mb-2 tracking-[0.08em]">SOE HUB / SUGGESTION BOX</span>
          <h1 className="mb-1 text-[30px] leading-none">Suggestion Box</h1>
          <p className="mb-0 text-xs text-ink-soft">
            Ideas, concerns, or feedback for the SOE student council. Signed or anonymous.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_320px] items-start gap-7 max-[900px]:grid-cols-1">
          <div className="min-w-0">
            {/* ---------- Compose ---------- */}
            <section className="tick-frame mb-5 animate-fade-in-up [animation-delay:0.04s]">
              <span className="tick-bl" />
              <span className="tick-br" />
              <form onSubmit={handleCompose} noValidate>
                <label htmlFor="suggestionContent" className="mb-2 text-[13px]">
                  What would you like the council to know?
                </label>
                <SuggestionFields
                  id="suggestionContent"
                  value={draft}
                  onChange={(next) => {
                    setDraft(next);
                    setJustSent(false);
                    if (draftError) setDraftError("");
                  }}
                />
                {draftError && (
                  <p role="alert" className="mb-2 text-[12.5px] text-[#b3261e]">
                    {draftError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[12.5px] text-[#2f7a4f]" role="status">
                    {justSent ? "Sent! You can track it under “My suggestions”." : ""}
                  </span>
                  <button type="submit" className="btn gap-1.5 px-5 py-2 text-[13.5px]">
                    <SendIcon />
                    Send suggestion
                  </button>
                </div>
              </form>
            </section>

            {/* ---------- My suggestions ---------- */}
            <section className="tick-frame animate-fade-in-up [animation-delay:0.08s]">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">My suggestions</span>
                <span className="mono text-[11px] text-ink-soft">{mine.length} sent</span>
              </div>

              {listError && (
                <p role="alert" className="mt-3 mb-0 text-[12.5px] text-[#b3261e]">
                  {listError}
                </p>
              )}

              {mine.length === 0 ? (
                <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">You haven&apos;t sent any suggestions yet.</p>
              ) : (
                <ul className="list-none">
                  {mine.map((s) =>
                    editing?.id === s.id ? (
                      <li key={s.id} className="border-b border-rule-soft py-3.5 last:border-b-0 last:pb-0">
                        <SuggestionEditor
                          suggestion={s}
                          initialValue={editing.value}
                          initialError={editing.error}
                          onSave={(value) => saveEdit(s, value)}
                          onCancel={() => setEditing(null)}
                        />
                      </li>
                    ) : (
                      <li
                        key={s.id}
                        className={[
                          "border-b border-rule-soft py-3.5 transition-opacity last:border-b-0 last:pb-0",
                          s.pending ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`tag ${STATUS_STYLES[s.status].className}`}>{STATUS_STYLES[s.status].label}</span>
                          {s.isAnonymous && <span className="tag border-ink-soft text-ink-soft">ANONYMOUS</span>}
                          <span className="ml-auto font-mono text-[11px] text-ink-soft">
                            {s.pending ? "Sending…" : formatTimestamp(s.createdAt)}
                            {s.edited && " · edited"}
                          </span>
                          {!s.pending && (
                            <PostMenu
                              noun="suggestion"
                              // Locked once the council has looked at it.
                              onEdit={s.status === "pending" ? () => setEditing({ id: s.id }) : undefined}
                              onDelete={() => setDeleting(s)}
                            />
                          )}
                        </div>
                        <p className="mb-0 whitespace-pre-line text-[14px] [overflow-wrap:anywhere]">{s.content}</p>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>
          </div>

          {/* ---------- How it works ---------- */}
          <aside className="tick-frame animate-fade-in-up [animation-delay:0.12s]">
            <span className="tick-bl" />
            <span className="tick-br" />
            <div className="mb-3 border-b border-rule pb-2.5">
              <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">How it works</span>
            </div>
            <ol className="list-none space-y-3 text-[13px] text-ink-soft">
              <li>
                <span className={`tag mr-1.5 ${STATUS_STYLES.pending.className}`}>PENDING</span>
                Sent and waiting for the council. You can still edit or delete it.
              </li>
              <li>
                <span className={`tag mr-1.5 ${STATUS_STYLES.reviewed.className}`}>REVIEWED</span>
                The council has read it. It can no longer be edited.
              </li>
              <li>
                <span className={`tag mr-1.5 ${STATUS_STYLES.resolved.className}`}>RESOLVED</span>
                Acted on or addressed.
              </li>
            </ol>
            <p className="mt-4 mb-0 border-t border-dashed border-rule pt-3 text-[11.5px] leading-snug text-ink-soft">
              Anonymous suggestions hide your name from the council. They stay linked to your account only so
              you can edit or delete them here.
            </p>
          </aside>
        </div>

        {inbox && <CouncilInbox items={inbox} />}
      </div>

      {confirmingSend && (
        <ConfirmDialog
          tone="confirm"
          title="Send this suggestion?"
          message={
            draft.isAnonymous ? (
              <>
                It will be sent <strong>anonymously</strong>. The council won&apos;t see your name.
              </>
            ) : (
              <>
                It will be sent with your name, <strong>{viewer.name}</strong>. Tick &ldquo;Send anonymously&rdquo;
                if you&apos;d rather not.
              </>
            )
          }
          confirmLabel="Send"
          busyLabel="Sending…"
          onCancel={() => setConfirmingSend(false)}
          onConfirm={send}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this suggestion?"
          message="It will be removed for you and the council. This can't be undone."
          confirmLabel="Delete"
          busyLabel="Deleting…"
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      )}
    </>
  );
}

function SuggestionFields({
  id,
  value,
  onChange,
}: {
  id: string;
  value: SuggestionInput;
  onChange: (value: SuggestionInput) => void;
}) {
  const remaining = MAX_LENGTH - value.content.length;

  return (
    <>
      <textarea
        id={id}
        rows={5}
        value={value.content}
        maxLength={MAX_LENGTH}
        onChange={(e) => onChange({ ...value, content: e.target.value })}
        placeholder="e.g. Could the org room stay open during lunch for students waiting on afternoon labs?"
        className="mb-1.5 resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="mb-0 flex cursor-pointer items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={value.isAnonymous}
            onChange={(e) => onChange({ ...value, isAnonymous: e.target.checked })}
            className="size-4 accent-navy"
          />
          Send anonymously
        </label>
        <span className={`font-mono text-[11px] ${remaining < 100 ? "text-orange" : "text-ink-soft"}`}>
          {remaining} characters left
        </span>
      </div>
    </>
  );
}

function SuggestionEditor({
  suggestion,
  initialValue,
  initialError = "",
  onSave,
  onCancel,
}: {
  suggestion: Suggestion;
  // Set when reopening after a failed save.
  initialValue?: SuggestionInput;
  initialError?: string;
  // The caller closes the editor and saves optimistically.
  onSave: (value: SuggestionInput) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<SuggestionInput>(
    initialValue ?? { content: suggestion.content, isAnonymous: suggestion.isAnonymous },
  );

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const unchanged = value.content.trim() === suggestion.content && value.isAnonymous === suggestion.isAnonymous;
    if (unchanged) onCancel();
    else onSave(value);
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <SuggestionFields id={`edit-${suggestion.id}`} value={value} onChange={setValue} />
      {initialError && (
        <p role="alert" className="mt-2 mb-0 text-[12.5px] text-[#b3261e]">
          {initialError}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn ghost px-4 py-1.5 text-[13px]" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn px-4 py-1.5 text-[13px]" disabled={!value.content.trim()}>
          Save changes
        </button>
      </div>
    </form>
  );
}

function CouncilInbox({ items }: { items: InboxItem[] }) {
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [error, setError] = useState("");

  // Shows the new status right away; resets to the server's list once it refreshes.
  const [optimisticItems, applyStatus] = useOptimistic(
    items,
    (current: InboxItem[], change: { id: string; status: Status }) =>
      current.map((item) => (item.id === change.id ? { ...item, status: change.status } : item)),
  );

  const counts = { pending: 0, reviewed: 0, resolved: 0 };
  for (const item of optimisticItems) counts[item.status]++;
  const visible = filter === "all" ? optimisticItems : optimisticItems.filter((item) => item.status === filter);

  function changeStatus(id: string, status: Status) {
    setError("");
    startTransition(async () => {
      applyStatus({ id, status });
      const result = await settle(setSuggestionStatus(id, status), "Couldn't update the status. Please try again.");
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="tick-frame mt-7 animate-fade-in-up [animation-delay:0.16s]">
      <span className="tick-bl" />
      <span className="tick-br" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2.5">
        <span className="mono text-[11px] uppercase tracking-[0.08em] text-navy">
          Council inbox <span className="text-ink-soft">· admins only</span>
        </span>
        <div className="w-[170px]">
          <Select
            value={filter}
            onChange={(v) => setFilter(v as Status | "all")}
            options={[
              { value: "pending", label: `Pending (${counts.pending})` },
              { value: "reviewed", label: `Reviewed (${counts.reviewed})` },
              { value: "resolved", label: `Resolved (${counts.resolved})` },
              { value: "all", label: `All (${optimisticItems.length})` },
            ]}
            aria-label="Filter suggestions by status"
            compact
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 mb-0 text-[12.5px] text-[#b3261e]">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="mb-0 pt-5 pb-1 text-[13px] text-ink-soft">
          {optimisticItems.length === 0 ? "No suggestions yet." : "Nothing here. You're all caught up."}
        </p>
      ) : (
        <ul className="list-none">
          {visible.map((item) => (
            <li key={item.id} className="flex gap-3 border-b border-rule-soft py-3.5 last:border-b-0 last:pb-0">
              {item.authorName && item.authorAvatar ? (
                <Image
                  src={item.authorAvatar}
                  alt=""
                  width={34}
                  height={34}
                  className="size-[34px] shrink-0 rounded-full border border-navy-tint object-cover"
                />
              ) : (
                <span
                  className={[
                    "flex size-[34px] shrink-0 items-center justify-center rounded-full border font-display text-[12px] font-semibold",
                    item.authorName ? "border-navy-tint bg-blue text-paper" : "border-dashed border-rule bg-vellum text-ink-soft",
                  ].join(" ")}
                >
                  {item.authorName ? item.authorInitials : "?"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <strong className={`text-[13.5px] font-semibold ${item.authorName ? "" : "italic text-ink-soft"}`}>
                    {item.authorName ?? "Anonymous"}
                  </strong>
                  <span className="font-mono text-[11px] text-ink-soft">
                    {formatTimestamp(item.createdAt)}
                    {item.edited && " · edited"}
                  </span>
                </div>
                <p className="mb-0 whitespace-pre-line text-[14px] [overflow-wrap:anywhere]">{item.content}</p>
              </div>
              <div className="w-[128px] shrink-0 max-[560px]:w-[112px]">
                <Select
                  value={item.status}
                  onChange={(v) => v !== item.status && changeStatus(item.id, v as Status)}
                  options={STATUS_OPTIONS}
                  aria-label="Suggestion status"
                  compact
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}
