"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, Lightbulb, Plus, Search, X } from "lucide-react";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS, PAGE_RESELECT_EVENT } from "@/components/NavigationHeader";
import Select from "@/components/Select";
import { toast } from "@/components/Toaster";
import type { Profile } from "@/lib/auth";
import {
  createSuggestion,
  deleteSuggestion,
  fetchSuggestions,
  updateSuggestion,
} from "@/lib/mock/suggestions-db";
import {
  CATEGORY_LABELS,
  SUGGESTION_CATEGORIES,
  type Suggestion,
  type SuggestionAuthor,
  type SuggestionCategory,
  type SuggestionInput,
} from "@/lib/suggestions";
import DeleteSuggestionDialog from "./DeleteSuggestionDialog";
import SuggestionCard from "./SuggestionCard";
import SuggestionModal from "./SuggestionModal";
import { CategoryIcon, toneClass } from "./ui";

type Props = {
  profile: Profile;
  isAdmin: boolean;
};

type Sort = "newest" | "oldest";
type Scope = "all" | "mine";

/** The suggestion modal: a blank one, one to edit, or either reopened after its save failed. */
type Editing = {
  suggestion?: Suggestion;
  draft?: SuggestionInput;
  error?: string;
};

const SAVE_ERROR = "Couldn't save your suggestion. Please try again.";
const FLASH_MS = 1600;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Puts a removed item back where it was, or as close as the list now allows. */
function reinsert<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
}

export default function SuggestionsContent({ profile, isAdmin }: Props) {
  const viewer = useMemo<SuggestionAuthor>(
    () => ({ id: profile.id, name: profile.name, initials: profile.initials, avatarUrl: profile.avatarUrl }),
    [profile.id, profile.name, profile.initials, profile.avatarUrl],
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => fetchSuggestions(viewer, isAdmin));
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  /** The card that was just saved, and how loudly to point it out. */
  const [flash, setFlash] = useState<{ id: string; kind: "new" | "edit" } | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SuggestionCategory | "ALL">("ALL");
  const [sort, setSort] = useState<Sort>("newest");
  const [scope, setScope] = useState<Scope>("all");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Suggestion | null>(null);

  // Clicking "Suggestion Box" while already here reloads the list.
  useEffect(() => {
    const reload = () => setSuggestions(fetchSuggestions(viewer, isAdmin));
    window.addEventListener(PAGE_RESELECT_EVENT, reload);
    return () => window.removeEventListener(PAGE_RESELECT_EVENT, reload);
  }, [viewer, isAdmin]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  // N opens a new suggestion, like C composes in most mail apps.
  useEffect(() => {
    if (editing || deleting) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key !== "n" && e.key !== "N") return;
      e.preventDefault();
      setEditing({});
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing, deleting]);

  const isOwn = (suggestion: Suggestion) => suggestion.authorId === viewer.id;

  // Admins can narrow the board to their own; everyone else only ever has their own.
  const scoped = isAdmin && scope === "mine" ? suggestions.filter(isOwn) : suggestions;

  const counts = Object.fromEntries(SUGGESTION_CATEGORIES.map((key) => [key, 0])) as Record<SuggestionCategory, number>;
  for (const suggestion of scoped) counts[suggestion.category] += 1;
  const topCount = Math.max(1, ...Object.values(counts));

  const q = query.trim().toLowerCase();
  const visible = scoped
    .filter((suggestion) => category === "ALL" || suggestion.category === category)
    .filter((suggestion) => {
      if (!q) return true;
      // Names only count when they're shown, so a search can't unmask anyone.
      const name = !suggestion.anonymous && suggestion.author ? suggestion.author.name : "";
      return [suggestion.title, suggestion.body, name].some((text) => text.toLowerCase().includes(q));
    })
    .sort((a, b) => (sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));

  const filtered = category !== "ALL" || q !== "";
  const mine = suggestions.filter(isOwn);
  const stats = isAdmin
    ? [
        { label: "Total", value: suggestions.length, tone: "navy" },
        { label: "Anonymous", value: suggestions.filter((s) => s.anonymous).length, tone: "anon" },
      ]
    : [
        { label: "Submitted", value: mine.length, tone: "navy" },
        { label: "Anonymous", value: mine.filter((s) => s.anonymous).length, tone: "anon" },
      ];

  function setPending(id: string, on: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setCategory("ALL");
  }

  // Every change shows at once and is rolled back if the save fails.
  async function save(input: SuggestionInput, original?: Suggestion) {
    if (original) {
      const patched: Suggestion = { ...original, ...input, updatedAt: new Date().toISOString() };
      setSuggestions((current) => current.map((item) => (item.id === original.id ? patched : item)));
      setPending(original.id, true);
      try {
        const saved = await updateSuggestion(viewer, input);
        setSuggestions((current) => current.map((item) => (item.id === original.id ? saved : item)));
        setFlash({ id: saved.id, kind: "edit" });
        toast("Suggestion updated.", "success");
      } catch (error) {
        console.error("[suggestions] update failed:", error);
        setSuggestions((current) => current.map((item) => (item.id === original.id ? original : item)));
        setEditing({ suggestion: original, draft: input, error: SAVE_ERROR });
      } finally {
        setPending(original.id, false);
      }
      return;
    }

    // A clear filter or search would hide the new card the moment it lands.
    if (category !== "ALL" && category !== input.category) setCategory("ALL");
    setQuery("");

    const tempId = `temp-${Date.now()}`;
    const placeholder: Suggestion = {
      id: tempId,
      ...input,
      authorId: viewer.id,
      author: viewer,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    setSuggestions((current) => [placeholder, ...current]);
    setPending(tempId, true);
    try {
      const saved = await createSuggestion(viewer, input);
      setSuggestions((current) => current.map((item) => (item.id === tempId ? saved : item)));
      setFlash({ id: saved.id, kind: "new" });
      toast(input.anonymous ? "Dropped in the box — anonymously." : "Dropped in the box. Thanks for speaking up!", "success");
    } catch (error) {
      console.error("[suggestions] create failed:", error);
      setSuggestions((current) => current.filter((item) => item.id !== tempId));
      setEditing({ draft: input, error: SAVE_ERROR });
    } finally {
      setPending(tempId, false);
    }
  }

  async function remove(target: Suggestion) {
    const index = suggestions.findIndex((item) => item.id === target.id);
    setSuggestions((current) => current.filter((item) => item.id !== target.id));
    try {
      await deleteSuggestion(viewer, isAdmin, target.id);
      toast(isOwn(target) ? "Suggestion deleted." : "Suggestion removed from the board.", "success");
    } catch (error) {
      console.error("[suggestions] delete failed:", error);
      setSuggestions((current) => reinsert(current, index, target));
      toast(`Couldn't delete "${target.title}". It's back on the board.`);
    }
  }

  const listLabel = isAdmin ? (scope === "mine" ? "My suggestions" : "All suggestions") : "My suggestions";

  return (
    <>
      <SiteNav
        initials={profile.initials}
        name={profile.name}
        userId={profile.id}
        avatarUrl={profile.avatarUrl}
        links={isAdmin ? HOME_ADMIN_NAV_LINKS : undefined}
        menuLinks={isAdmin ? ADMIN_MENU_LINKS : undefined}
      />

      <div className="page-wrap">
        <div className="sgHero">
          <div className="sgHeroMain">
            <span className="eyebrow sgHeroEyebrow">
              SOE HUB / SUGGESTION BOX{isAdmin && <span className="sgAdminTag"> · COUNCIL VIEW</span>}
            </span>
            <h1>{isAdmin ? "THE INBOX" : "SPEAK UP"}</h1>
            <div className="sgHeroRule">
              <span className="mono sgHeroLine">
                <span className="sgLiveDot" aria-hidden="true" />
                {isAdmin ? "WHAT STUDENTS WANT CHANGED" : "YOUR IDEAS GO STRAIGHT TO THE COUNCIL"}
              </span>
            </div>

            <ul className="sgStats" aria-label="At a glance">
              {stats.map((stat, index) => (
                <li
                  key={stat.label}
                  className={`sgStat tone-${stat.tone}`}
                  style={{ animationDelay: `${0.12 + index * 0.07}s` }}
                >
                  <span key={stat.value} className="sgStatValue">
                    {String(stat.value).padStart(2, "0")}
                  </span>
                  <span className="mono sgStatLabel">{stat.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="sgDrop tick-frame" aria-label={isAdmin ? "Council inbox" : "Drop a suggestion"}>
            <span className="tick-bl" />
            <span className="tick-br" />
            <DropBoxArt count={isAdmin ? suggestions.length : mine.length} />
            <div className="sgDropText">
              <h2>{isAdmin ? "Council inbox" : "Got an idea?"}</h2>
              <p>
                {isAdmin
                  ? "Take down anything that breaks the house rules."
                  : "Only the SOE council reads it, and you can hide your name."}
              </p>
            </div>
            <button type="button" className="btn primary sgDropBtn" onClick={() => setEditing({})} title="Shortcut: N">
              <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
              Drop a suggestion
            </button>
          </aside>
        </div>

        <div className="sgLayout">
          <div className="sgMain">
            <div className="sgToolbar tick-frame">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="sgToolbarInner">
                <div className="sgSearch">
                  <span className="sgSearchIcon">
                    <Search size={15} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <input
                    type="text"
                    className="sgSearchInput"
                    placeholder={isAdmin ? "Search suggestions…" : "Search your suggestions…"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search suggestions"
                  />
                  {query && (
                    <button type="button" className="sgSearchClear" onClick={() => setQuery("")} aria-label="Clear search">
                      <X size={13} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="sgToolbarActions">
                  {isAdmin && (
                    <div className="sgSegment" role="group" aria-label="Show">
                      <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
                        All
                      </button>
                      <button type="button" aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>
                        Mine
                      </button>
                    </div>
                  )}
                  <div className="sgSortWrap">
                    <Select
                      id="suggestionSort"
                      value={sort}
                      onChange={(value) => setSort(value as Sort)}
                      options={[
                        { value: "newest", label: "Newest" },
                        { value: "oldest", label: "Oldest" },
                      ]}
                      aria-label="Sort suggestions"
                      compact
                    />
                  </div>
                  <button
                    type="button"
                    className="btn sgNewBtn"
                    onClick={() => setEditing({})}
                    aria-label="New suggestion"
                    title="Shortcut: N"
                  >
                    <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
                    <span className="sgNewLabel">New</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="sgChips" role="group" aria-label="Filter by category">
              <button
                type="button"
                className={`sgFilter isAll${category === "ALL" ? " isActive" : ""}`}
                aria-pressed={category === "ALL"}
                aria-label={`All (${scoped.length})`}
                onClick={() => setCategory("ALL")}
              >
                All
                <span className="mono sgFilterCount">{scoped.length}</span>
              </button>
              {SUGGESTION_CATEGORIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`sgFilter ${toneClass(key)}${category === key ? " isActive" : ""}`}
                  aria-pressed={category === key}
                  aria-label={`${CATEGORY_LABELS[key]} (${counts[key]})`}
                  title={CATEGORY_LABELS[key]}
                  onClick={() => setCategory(category === key ? "ALL" : key)}
                >
                  <CategoryIcon category={key} size={13} />
                  <span className="sgFilterLabel">{CATEGORY_LABELS[key]}</span>
                  <span className="mono sgFilterCount">{counts[key]}</span>
                </button>
              ))}
            </div>

            <section className="sgBoard" aria-label={listLabel}>
              <header className="sgBoardHead">
                <span className="sgBoardIcon">
                  {isAdmin && scope === "all" ? (
                    <Inbox size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Lightbulb size={14} strokeWidth={2} aria-hidden="true" />
                  )}
                </span>
                <span className="mono sgBoardLabel">{listLabel}</span>
                <span className="mono sgBoardMeta" aria-live="polite">
                  {filtered ? `${visible.length} of ${scoped.length}` : `${scoped.length} in the box`}
                </span>
              </header>

              {visible.length > 0 ? (
                <div className="sgGrid">
                  {visible.map((suggestion, index) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      isOwn={isOwn(suggestion)}
                      isAdmin={isAdmin}
                      pending={pendingIds.has(suggestion.id)}
                      flash={flash?.id === suggestion.id ? flash.kind : null}
                      index={index}
                      onEdit={(target) => setEditing({ suggestion: target })}
                      onDelete={setDeleting}
                    />
                  ))}
                </div>
              ) : scoped.length === 0 ? (
                <div className="sgEmpty">
                  <span className="sgEmptyArt" aria-hidden="true">
                    <Lightbulb size={26} strokeWidth={1.8} />
                  </span>
                  <h3>{isAdmin && scope === "all" ? "The box is empty" : "Nothing in the box yet"}</h3>
                  <p>
                    {isAdmin && scope === "all"
                      ? "When students drop suggestions, they'll show up here."
                      : "Spotted something that could be better? Your first suggestion takes a minute."}
                  </p>
                  <button type="button" className="btn primary" onClick={() => setEditing({})}>
                    <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                    Drop a suggestion
                  </button>
                </div>
              ) : (
                <div className="sgEmpty isFiltered">
                  <span className="sgEmptyArt" aria-hidden="true">
                    <Search size={22} strokeWidth={2} />
                  </span>
                  <h3>No matches</h3>
                  <p>No suggestions fit {q ? <>&ldquo;{query.trim()}&rdquo;</> : "that filter"}.</p>
                  <button type="button" className="btn ghost" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="sgSide">
            <section className="sgSideBlock tick-frame">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="sgSectionHead">
                <span className="mono sgSectionLabel">
                  <span className="sgSectionNum">01</span> By category
                </span>
                <span className="mono sgSectionMeta">{scoped.length}</span>
              </div>
              <ul className="sgBars">
                {SUGGESTION_CATEGORIES.map((key, index) => (
                  <li key={key} className={toneClass(key)}>
                    <button
                      type="button"
                      className={category === key ? "isActive" : undefined}
                      aria-pressed={category === key}
                      onClick={() => setCategory(category === key ? "ALL" : key)}
                    >
                      <span className="sgBarTop">
                        <span className="sgBarName">
                          <CategoryIcon category={key} size={13} />
                          {CATEGORY_LABELS[key]}
                        </span>
                        <span className="mono sgBarCount">{counts[key]}</span>
                      </span>
                      <span className="sgBarTrack">
                        <span
                          className="sgBarFill"
                          style={{ width: `${(counts[key] / topCount) * 100}%`, animationDelay: `${0.2 + index * 0.06}s` }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sgSideBlock tick-frame">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="sgSectionHead">
                <span className="mono sgSectionLabel">
                  <span className="sgSectionNum">02</span> House rules
                </span>
              </div>
              <ol className="sgRules">
                <li>Keep it respectful — no names, insults or personal attacks.</li>
                <li>One idea per suggestion, so the council can act on it.</li>
                <li>Anonymous hides your name from the council. You can still edit or delete it.</li>
                <li>Suggestions that break these rules are taken down.</li>
              </ol>
            </section>
          </aside>
        </div>
      </div>

      {editing && (
        <SuggestionModal
          suggestion={editing.suggestion}
          draft={editing.draft}
          initialError={editing.error}
          viewer={viewer}
          onClose={() => setEditing(null)}
          onSave={(input) => save(input, editing.suggestion)}
        />
      )}

      {deleting && (
        <DeleteSuggestionDialog
          suggestion={deleting}
          mode={isOwn(deleting) ? "own" : "moderate"}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
          onDone={() => setDeleting(null)}
        />
      )}

      <style jsx global>{`
        /* ---------- Category colours ---------- */
        .sgTone-academic {
          --sg-tone: #2a7468;
          --sg-tint: #dcefea;
        }

        .sgTone-facilities {
          --sg-tone: #2e5c8a;
          --sg-tint: #e1eaf4;
        }

        .sgTone-events {
          --sg-tone: #d9531e;
          --sg-tint: #fcebdf;
        }

        .sgTone-council {
          --sg-tone: #6b4fa0;
          --sg-tint: #ece6f6;
        }

        .sgTone-other {
          --sg-tone: #4b5468;
          --sg-tint: #e9e6dd;
        }

        /* ---------- Avatars (cards, modal) ---------- */
        .sgAvatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--blue);
          border: 1px solid var(--navy-tint);
          color: var(--white);
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          line-height: 1;
          object-fit: cover;
        }

        .sgAvatar.isMask {
          background: var(--navy-deep);
          border-color: var(--navy-deep);
          color: var(--yellow);
        }

        /* ---------- Hero ---------- */
        .sgHero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 28px;
          align-items: stretch;
          margin-bottom: 28px;
        }

        /* Stats sit on the bottom edge, level with the bottom of the drop box card. */
        .sgHeroMain {
          display: flex;
          flex-direction: column;
          min-width: 0;
          animation: fadeInUp 0.5s ease backwards;
        }

        .sgHeroEyebrow {
          margin-bottom: 8px;
          letter-spacing: 0.08em;
        }

        .sgAdminTag {
          color: var(--orange);
        }

        .sgHero h1 {
          margin-bottom: 0;
          font-size: var(--fs-display);
          line-height: 1;
        }

        .sgHeroRule {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 14px;
        }

        .sgHeroRule::after {
          content: "";
          flex: 1;
          border-top: 1px solid #c9bfa0;
        }

        .sgHeroLine {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
        }

        .sgLiveDot {
          width: 7px;
          height: 7px;
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--orange);
          animation: sgPulse 2s ease-out infinite;
        }

        @keyframes sgPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(217, 83, 30, 0.5);
          }
          70%,
          100% {
            box-shadow: 0 0 0 7px rgba(217, 83, 30, 0);
          }
        }

        .sgStats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 220px));
          gap: 12px;
          margin-top: auto;
          padding-top: 18px;
          list-style: none;
        }

        .sgStat {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 10px 14px 11px;
          overflow: hidden;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          animation: fadeInUp 0.45s ease backwards;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .sgStat.tone-navy {
          --stat: var(--navy);
        }

        .sgStat.tone-orange {
          --stat: var(--orange);
        }

        .sgStat.tone-anon {
          --stat: #6b4fa0;
        }

        .sgStat::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--stat);
        }

        .sgStat:hover {
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--stat);
        }

        .sgStatValue {
          font-family: "Space Grotesk", sans-serif;
          font-size: var(--fs-stat);
          font-weight: 700;
          line-height: 1;
          color: var(--navy-deep);
          font-variant-numeric: tabular-nums;
          animation: sgPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        @keyframes sgPop {
          from {
            transform: scale(0.6);
            opacity: 0;
          }
        }

        .sgStatLabel {
          margin-top: 4px;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--stat);
        }

        /* ---------- Drop box card ---------- */
        /* Art beside the words, button underneath, so the card stays as short as the hero beside it. */
        .sgDrop.tick-frame {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-areas:
            "art text"
            "btn btn";
          align-items: center;
          align-content: center;
          gap: 12px 16px;
          padding: 16px 18px;
          background:
            radial-gradient(ellipse 160px 110px at 18% 30%, rgba(253, 247, 1, 0.18), transparent 70%),
            var(--white);
          box-shadow: 0 14px 32px -20px rgba(13, 30, 56, 0.45);
          animation: fadeInUp 0.45s ease backwards;
          animation-delay: 0.08s;
        }

        .sgDropText {
          grid-area: text;
          min-width: 0;
        }

        .sgDropText h2 {
          margin: 0 0 2px;
          font-size: 18px;
        }

        .sgDropText p {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.45;
          color: var(--ink-soft);
        }

        .sgDropBtn {
          grid-area: btn;
          width: 100%;
          gap: 7px;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .sgDropBtn:hover {
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--navy-deep), 6px 6px 0 var(--yellow);
        }

        .sgDropBtn:active {
          transform: none;
          box-shadow: none;
        }

        .sgDropBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 3px;
        }

        .sgBox {
          grid-area: art;
          display: block;
          width: 96px;
          height: auto;
          overflow: visible;
        }

        /* A note slides down through the slot, over and over. */
        .sgBoxNote {
          animation: sgNoteDrop 3.2s cubic-bezier(0.55, 0, 0.45, 1) infinite;
        }

        @keyframes sgNoteDrop {
          0% {
            transform: translateY(-14px) rotate(-6deg);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          40% {
            transform: translateY(-2px) rotate(0deg);
          }
          70%,
          100% {
            transform: translateY(46px) rotate(0deg);
            opacity: 1;
          }
        }

        /* The box gives a little bounce each time a note lands. */
        .sgBoxBody {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: sgBoxBump 3.2s ease infinite;
        }

        @keyframes sgBoxBump {
          0%,
          66%,
          100% {
            transform: none;
          }
          72% {
            transform: scale(1.04, 0.96);
          }
          80% {
            transform: scale(0.99, 1.01);
          }
        }

        .sgBoxBadge {
          transform-box: fill-box;
          transform-origin: center;
          animation: sgPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        /* ---------- Layout ---------- */
        .sgLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 28px;
          align-items: start;
        }

        .sgMain {
          min-width: 0;
        }

        /* ---------- Toolbar ---------- */
        .sgToolbar {
          padding: 12px 20px;
          margin-bottom: 14px;
          animation: fadeInUp 0.45s ease backwards;
          animation-delay: 0.05s;
        }

        .sgToolbarInner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .sgSearch {
          position: relative;
          flex: 1;
          max-width: 320px;
          min-width: 0;
        }

        .sgSearchIcon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          color: var(--ink-soft);
          pointer-events: none;
        }

        .sgSearchInput {
          width: 100%;
          height: 36px;
          margin-bottom: 0 !important;
          padding: 0 30px 0 32px !important;
          font-size: 13px !important;
          box-shadow: none !important;
        }

        .sgSearchInput:focus {
          outline: none;
          border-color: #b9ae92;
          box-shadow: 0 0 0 3px rgba(19, 42, 77, 0.08) !important;
        }

        .sgSearchClear {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          padding: 4px;
          border: none;
          border-radius: 50%;
          background: var(--vellum-2);
          color: var(--ink-soft);
          cursor: pointer;
          animation: popIn 0.15s ease backwards;
        }

        .sgSearchClear:hover {
          background: var(--navy);
          color: var(--white);
        }

        .sgToolbarActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .sgSortWrap {
          position: relative;
          z-index: 10;
          width: 116px;
          flex-shrink: 0;
        }

        .sgSortWrap .selectTrigger {
          height: 36px;
          padding-top: 0;
          padding-bottom: 0;
        }

        .sgSegment {
          display: inline-flex;
          height: 36px;
          padding: 3px;
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          background: var(--vellum);
        }

        .sgSegment button {
          min-width: 52px;
          padding: 0 12px;
          border: none;
          border-radius: 4px;
          background: none;
          font: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }

        .sgSegment button:hover {
          color: var(--navy);
        }

        .sgSegment button[aria-pressed="true"] {
          background: var(--white);
          color: var(--navy-deep);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(13, 30, 56, 0.18);
        }

        .sgSegment button:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .sgNewBtn {
          height: 36px;
          padding: 0 14px;
          gap: 6px;
          font-size: 13px;
          white-space: nowrap;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .sgNewBtn:hover {
          box-shadow: 0 2px 6px rgba(19, 42, 77, 0.18);
        }

        .sgNewBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        /* ---------- Category chips ---------- */
        .sgChips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
          animation: fadeInUp 0.45s ease backwards;
          animation-delay: 0.1s;
        }

        .sgFilter {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 6px 0 11px;
          border: 1px solid #c9bfa0;
          border-radius: 999px;
          background: var(--white);
          color: var(--ink);
          font: inherit;
          font-size: 12.5px;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }

        .sgFilter svg {
          color: var(--sg-tone);
        }

        .sgFilter:hover {
          border-color: var(--sg-tone, var(--navy));
          transform: translateY(-1px);
        }

        .sgFilter.isActive {
          border-color: var(--sg-tone, var(--navy));
          background: var(--sg-tone, var(--navy));
          color: var(--white);
        }

        .sgFilter.isActive svg {
          color: var(--white);
        }

        .sgFilter.isAll {
          padding-left: 13px;
        }

        .sgFilter:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        .sgFilterCount {
          min-width: 20px;
          padding: 1px 6px;
          border-radius: 999px;
          background: var(--vellum);
          color: var(--ink-soft);
          font-size: 10.5px;
          text-align: center;
        }

        .sgFilter.isActive .sgFilterCount {
          background: rgba(255, 255, 255, 0.2);
          color: var(--white);
        }

        /* ---------- Board ---------- */
        .sgBoard {
          animation: fadeInUp 0.45s ease backwards;
          animation-delay: 0.12s;
        }

        .sgBoardHead {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 22px;
          padding: 11px 20px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-bottom-color: var(--navy);
          border-radius: 8px;
          color: var(--navy);
        }

        .sgBoardIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #fcebdf;
          color: var(--orange);
        }

        .sgBoardLabel {
          flex: 1;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .sgBoardMeta {
          padding: 2px 8px;
          border: 1px solid var(--rule-soft);
          border-radius: 999px;
          background: var(--vellum);
          font-size: 10.5px;
          color: var(--ink-soft);
          white-space: nowrap;
        }

        /* Desktop and tablet: two columns of notes. Room above each row for the tape. */
        .sgGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px 18px;
        }

        .sgEmpty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 24px 36px;
          text-align: center;
          border: 1px dashed #c9bfa0;
          border-radius: 8px;
          background: rgba(251, 250, 246, 0.7);
          animation: fadeInUp 0.35s ease backwards;
        }

        .sgEmptyArt {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          margin-bottom: 14px;
          border-radius: 50%;
          background: var(--white);
          border: 1px dashed #c9bfa0;
          color: var(--orange);
          box-shadow: 0 0 0 8px rgba(217, 83, 30, 0.06);
          animation: sgFloat 3s ease-in-out infinite;
        }

        @keyframes sgFloat {
          50% {
            transform: translateY(-4px);
          }
        }

        .sgEmpty h3 {
          margin: 0 0 4px;
          font-size: 19px;
        }

        .sgEmpty p {
          max-width: 340px;
          margin: 0 0 16px;
          font-size: 13.5px;
          color: var(--ink-soft);
        }

        .sgEmpty .btn {
          gap: 7px;
          padding: 9px 18px;
          font-size: 13.5px;
        }

        /* ---------- Sidebar ---------- */
        .sgSide {
          position: sticky;
          top: calc(var(--nav-offset, 0px) + 20px);
          display: flex;
          flex-direction: column;
          gap: 22px;
          transition: top 0.25s ease;
        }

        .sgSideBlock {
          animation: fadeInUp 0.4s ease backwards;
          animation-delay: 0.1s;
        }

        .sgSideBlock + .sgSideBlock {
          animation-delay: 0.18s;
        }

        .sgSectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #c9bfa0;
        }

        .sgSectionLabel {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
        }

        .sgSectionNum {
          margin-right: 6px;
          color: var(--orange);
        }

        .sgSectionMeta {
          padding: 1px 8px;
          border: 1px solid var(--rule-soft);
          border-radius: 999px;
          background: var(--vellum);
          font-size: 10.5px;
          color: var(--ink-soft);
        }

        .sgBars {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 10px;
          list-style: none;
        }

        .sgBars button {
          display: flex;
          flex-direction: column;
          gap: 5px;
          width: 100%;
          padding: 7px 8px;
          border: none;
          border-radius: 5px;
          background: none;
          font: inherit;
          text-align: left;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s ease, transform 0.15s ease;
        }

        .sgBars button:hover {
          background: var(--vellum);
          transform: translateX(3px);
        }

        .sgBars button.isActive {
          background: var(--sg-tint);
          box-shadow: inset 3px 0 0 var(--sg-tone);
        }

        .sgBars button:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .sgBarTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .sgBarName {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--navy-deep);
        }

        .sgBarName svg {
          color: var(--sg-tone);
        }

        .sgBarCount {
          font-size: 11px;
          color: var(--sg-tone);
        }

        .sgBarTrack {
          display: block;
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--vellum-2);
        }

        .sgBarFill {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--sg-tone);
          transform-origin: left;
          transition: width 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
          animation: sgGrow 0.6s cubic-bezier(0.34, 1.3, 0.64, 1) backwards;
        }

        @keyframes sgGrow {
          from {
            transform: scaleX(0);
          }
        }

        .sgRules {
          margin-top: 12px;
          padding-left: 0;
          list-style: none;
          counter-reset: rule;
        }

        .sgRules li {
          position: relative;
          padding: 6px 0 6px 30px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink-soft);
          counter-increment: rule;
        }

        .sgRules li + li {
          border-top: 1px dashed var(--rule-soft);
        }

        .sgRules li::before {
          content: counter(rule, decimal-leading-zero);
          position: absolute;
          left: 0;
          top: 7px;
          font-family: "IBM Plex Mono", monospace;
          font-size: 11px;
          color: var(--orange);
        }

        /* ---------- Tablet (521–900px) ---------- */
        @media (max-width: 900px) {
          .sgHero,
          .sgLayout {
            grid-template-columns: minmax(0, 1fr);
          }

          /* Full width now, so art, words and button share one row. */
          .sgDrop.tick-frame {
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas: "art text btn";
            gap: 20px;
            padding: 14px 22px;
          }

          .sgBox {
            width: 84px;
          }

          .sgDropBtn {
            width: auto;
          }

          /* The category chips already filter, so the sidebar steps aside. */
          .sgSide {
            display: none;
          }
        }

        /* The two-column board only fits from small tablets up. */
        @media (max-width: 640px) {
          .sgGrid {
            grid-template-columns: minmax(0, 1fr);
            gap: 22px;
          }
        }

        /* ---------- Phone (520px and below) ---------- */
        @media (max-width: 520px) {
          .sgHero {
            gap: 20px;
            margin-bottom: 20px;
          }

          .sgStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            padding-top: 16px;
          }

          .sgStat {
            padding: 9px 10px 10px 12px;
          }

          .sgStatLabel {
            font-size: 9.5px;
            letter-spacing: 0.04em;
          }

          .sgHeroLine {
            font-size: 11px;
          }

          .sgDrop.tick-frame {
            grid-template-columns: auto minmax(0, 1fr);
            grid-template-areas:
              "art text"
              "btn btn";
            gap: 12px 14px;
            padding: 14px 16px 16px;
          }

          .sgBox {
            width: 72px;
          }

          .sgDropText h2 {
            font-size: 17px;
          }

          .sgDropText p {
            font-size: 12.5px;
          }

          .sgDropBtn {
            width: 100%;
            padding: 9px 12px;
            font-size: 13px;
          }

          /* Search on one row; segment, sort and the icon-only New button on the next. */
          .sgToolbar {
            padding: 10px 12px;
          }

          .sgToolbarInner {
            flex-wrap: wrap;
            gap: 8px;
          }

          .sgSearch {
            flex-basis: 100%;
            max-width: none;
          }

          .sgToolbarActions {
            width: 100%;
            gap: 8px;
          }

          .sgSortWrap {
            flex: 1;
            width: auto;
          }

          .sgNewBtn {
            padding: 0 10px;
          }

          .sgNewLabel {
            display: none;
          }

          /* Segments of one strip, like the announcement feed: square inner edges, rounded outer
             corners, a 4px seam between each. Every filter keeps the same slot; only the drawn
             segment (::before) shrinks into a circle when picked, so nothing beside it moves.
             Names show as tooltips and to screen readers. */
          .sgChips {
            flex-wrap: nowrap;
            gap: 4px;
            margin-bottom: 18px;
          }

          .sgFilter,
          .sgFilter.isAll,
          .sgFilter.isActive {
            position: relative;
            isolation: isolate;
            flex: 1 1 0;
            justify-content: center;
            min-width: 0;
            height: 40px;
            padding: 0;
            border: none;
            border-radius: 0;
            background: none;
          }

          .sgFilter:hover {
            transform: none;
          }

          .sgFilter::before {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: -1;
            border: 1px solid #c9bfa0;
            border-radius: 0;
            background: var(--white);
            transition: left 0.25s ease-out, right 0.25s ease-out, border-radius 0.25s ease-out,
              background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          }

          .sgFilter:first-child::before {
            border-radius: 8px 0 0 8px;
          }

          .sgFilter:last-child::before {
            border-radius: 0 8px 8px 0;
          }

          /* 40px wide with a 20px radius: a circle centred in the slot. */
          .sgChips .sgFilter.isActive::before {
            left: calc(50% - 20px);
            right: calc(50% - 20px);
            border-radius: 20px;
            border-color: var(--sg-tone, var(--navy));
            background: var(--sg-tone, var(--navy));
            box-shadow: 0 2px 6px rgba(13, 30, 56, 0.22);
          }

          .sgFilter svg {
            width: 17px;
            height: 17px;
          }

          .sgFilterLabel,
          .sgFilterCount {
            display: none;
          }

          .sgBoardHead {
            padding: 10px 14px;
            margin-bottom: 20px;
          }

          .sgEmpty {
            padding: 32px 18px 28px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sgFilter::before {
            transition: none;
          }

          .sgLiveDot,
          .sgStat,
          .sgStatValue,
          .sgBoxNote,
          .sgBoxBody,
          .sgBoxBadge,
          .sgEmptyArt,
          .sgBarFill {
            animation: none;
          }

          .sgStat,
          .sgFilter,
          .sgBars button,
          .sgBarFill,
          .sgDropBtn {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

/** A navy suggestion box with a note dropping through its slot; the badge counts what's inside. */
function DropBoxArt({ count }: { count: number }) {
  return (
    <svg className="sgBox" viewBox="0 0 140 112" aria-hidden="true">
      <defs>
        {/* Everything below the slot is hidden, so the note disappears into the box. */}
        <clipPath id="sgSlotClip">
          <rect x="0" y="-30" width="140" height="68" />
        </clipPath>
      </defs>

      {/* Shadow */}
      <ellipse cx="70" cy="106" rx="50" ry="4" fill="rgba(13, 30, 56, 0.14)" />

      <g clipPath="url(#sgSlotClip)">
        <g className="sgBoxNote">
          <rect x="52" y="4" width="36" height="40" rx="2" fill="#fbfaf6" stroke="#c9bfa0" />
          <rect x="52" y="4" width="36" height="5" rx="1" fill="#d9531e" />
          <line x1="58" y1="17" x2="82" y2="17" stroke="#c6d3e5" strokeWidth="2" strokeLinecap="round" />
          <line x1="58" y1="24" x2="78" y2="24" stroke="#c6d3e5" strokeWidth="2" strokeLinecap="round" />
          <line x1="58" y1="31" x2="80" y2="31" stroke="#c6d3e5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>

      <g className="sgBoxBody">
        {/* Lid with the slot */}
        <path d="M16 38 L30 28 H110 L124 38 Z" fill="#2e5c8a" />
        <rect x="46" y="31.5" width="48" height="4" rx="2" fill="#0d1e38" />
        {/* Front */}
        <rect x="16" y="38" width="108" height="64" rx="3" fill="#132a4d" />
        <rect x="16" y="38" width="108" height="5" fill="#d9531e" />
        <rect x="16" y="43" width="108" height="2" fill="#fdf701" />
        {/* Blueprint grid on the front */}
        <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
          <line x1="16" y1="60" x2="124" y2="60" />
          <line x1="16" y1="78" x2="124" y2="78" />
          <line x1="43" y1="45" x2="43" y2="102" />
          <line x1="70" y1="45" x2="70" y2="102" />
          <line x1="97" y1="45" x2="97" y2="102" />
        </g>
        {/* Lightbulb mark */}
        <g transform="translate(70 70)" fill="none" stroke="#fbfaf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-5 6 h10 M-3.5 10 h7" />
          <path d="M-5 3 C-5 -1 -9 -3 -9 -8 A9 9 0 0 1 9 -8 C9 -3 5 -1 5 3 Z" fill="rgba(253,247,1,0.18)" />
        </g>
        <text
          x="70"
          y="96"
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="7.5"
          letterSpacing="1.6"
          fill="#c6d3e5"
        >
          SUGGESTIONS
        </text>
      </g>

      {/* Count badge on the corner */}
      <g key={count} className="sgBoxBadge">
        <circle cx="122" cy="36" r="12" fill="#d9531e" stroke="#fbfaf6" strokeWidth="2.5" />
        <text
          x="122"
          y="40"
          textAnchor="middle"
          fontFamily="Space Grotesk, sans-serif"
          fontWeight="700"
          fontSize="11"
          fill="#fbfaf6"
        >
          {count > 99 ? "99+" : count}
        </text>
      </g>
    </svg>
  );
}
