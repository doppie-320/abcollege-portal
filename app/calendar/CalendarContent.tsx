"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS } from "@/components/NavigationHeader";
import BirthdayPanel, { CakeIcon } from "./BirthdayPanel";
import DeleteEventDialog from "./DeleteEventDialog";
import EventModal from "./EventModal";
import UpNext from "./UpNext";
import { deleteEvent, saveEvent, setBirthdayVisibility } from "./actions";
import { toast } from "@/components/Toaster";
import { settle } from "@/lib/actionResult";
import type { Profile } from "@/lib/auth";
import { fetchCalendarMonth, type MonthData } from "@/lib/calendar-data";
import { createClient } from "@/lib/supabase/client";
import {
  EVENT_TAGS,
  MONTH_NAMES,
  TAG_LABELS,
  WEEKDAY_NAMES,
  compareEvents,
  dayOf,
  daysInMonth,
  eventDays,
  eventEndDay,
  eventStartDay,
  formatEventDates,
  formatEventTime,
  formatLongDay,
  formatTime,
  makeDayKey,
  monthGrid,
  monthKey,
  monthOfDay,
  parseMonthParam,
  shiftMonth,
  weekdayOf,
  type CalendarEvent,
  type Celebrant,
  type EventInput,
  type MonthView,
} from "@/lib/calendar";

type CalendarContentProps = {
  profile: Profile;
  isAdmin: boolean;
  view: MonthView;
  /** "YYYY-MM-DD" in school time, decided on the server. */
  today: string;
  events: CalendarEvent[];
  celebrants: Celebrant[];
  nextEvent: CalendarEvent | null;
};

/** Event chips drawn inside one day before collapsing into "N more". */
const MAX_PILLS = 3;

type VisibilityChange = { userIds: string[]; hidden: boolean };

type EventChange = { type: "save"; event: CalendarEvent } | { type: "delete"; id: number };

/** The event modal: a blank one, an event to edit, or either reopened after its save failed. */
type Editing = {
  event?: CalendarEvent;
  draft?: EventInput;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const SAVE_ERROR = "Couldn't save the event. Please try again.";

// Stable empties for a month that's still loading, so memoised children don't re-render.
const NO_EVENTS: CalendarEvent[] = [];
const NO_CELEBRANTS: Celebrant[] = [];

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export default function CalendarContent({
  profile,
  isAdmin,
  view: serverView,
  today,
  events: serverEvents,
  celebrants: serverCelebrants,
  nextEvent,
}: CalendarContentProps) {
  const [supabase] = useState(createClient);
  const router = useRouter();
  // When the countdown runs out, the server picks the next event.
  const refreshNextEvent = useCallback(() => router.refresh(), [router]);
  const [visibilityPending, startVisibility] = useTransition();
  const [, startEventChange] = useTransition();
  const [view, setView] = useState(serverView);
  /** Months loaded so far, by "YYYY-MM", starting with the one the server rendered. */
  const [months, setMonths] = useState<Record<string, MonthData>>(() => ({
    [monthKey(serverView)]: { events: serverEvents, celebrants: serverCelebrants },
  }));
  const [failedMonth, setFailedMonth] = useState<string | null>(null);
  const requested = useRef(new Set<string>());
  const [serverData, setServerData] = useState({ serverEvents, serverCelebrants });
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  /** Which way the grid slides in after a month change. */
  const [slide, setSlide] = useState<"prev" | "next" | null>(null);
  const [visibilityError, setVisibilityError] = useState("");

  // Saving an event or hiding a birthday re-renders the page on the server. That data is the
  // freshest, so start over from it; other months are fetched again when needed.
  if (serverData.serverEvents !== serverEvents || serverData.serverCelebrants !== serverCelebrants) {
    setServerData({ serverEvents, serverCelebrants });
    setView(serverView);
    setMonths({ [monthKey(serverView)]: { events: serverEvents, celebrants: serverCelebrants } });
  }

  const currentMonth = monthKey(view);
  const monthData = months[currentMonth];
  const loading = !monthData && failedMonth !== currentMonth;
  const celebrants = monthData?.celebrants ?? NO_CELEBRANTS;

  // Saved and deleted events show at once; the refreshed page data then takes over.
  const [events, applyEventChange] = useOptimistic(
    monthData?.events ?? NO_EVENTS,
    (state: CalendarEvent[], change: EventChange) =>
      change.type === "delete"
        ? state.filter((event) => event.id !== change.id)
        : state.some((event) => event.id === change.event.id)
          ? state.map((event) => (event.id === change.event.id ? change.event : event))
          : [...state, change.event],
  );

  // Fetch the month on screen if needed, and its neighbours ahead of time so the arrows feel instant.
  useEffect(() => {
    for (const target of [view, shiftMonth(view, -1), shiftMonth(view, 1)]) {
      const key = monthKey(target);
      if (months[key] || requested.current.has(key) || key === failedMonth) continue;

      requested.current.add(key);
      fetchCalendarMonth(supabase, target)
        .then((data) => setMonths((current) => ({ ...current, [key]: data })))
        .catch((error) => {
          console.error(`[calendar] loading ${key} failed:`, error);
          // Neighbours are retried on the next month change; only the visible month shows an error.
          if (key === monthKey(view)) setFailedMonth(key);
        })
        .finally(() => requested.current.delete(key));
    }
  }, [view, months, failedMonth, supabase]);

  // Back / forward through months visited on this page.
  useEffect(() => {
    function onPopState() {
      const param = new URLSearchParams(window.location.search).get("month") ?? undefined;
      setSlide(null);
      setView(parseMonthParam(param, today));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [today]);

  // Admin show/hide clicks apply at once; the refreshed page data then takes over.
  const [shownCelebrants, applyVisibility] = useOptimistic(
    celebrants,
    (state: Celebrant[], change: VisibilityChange) =>
      state.map((celebrant) =>
        change.userIds.includes(celebrant.id) ? { ...celebrant, hidden: change.hidden } : celebrant,
      ),
  );

  const lastDate = daysInMonth(view);
  const monthStart = makeDayKey(view.year, view.month, 1);
  const monthEnd = makeDayKey(view.year, view.month, lastDate);
  const monthName = MONTH_NAMES[view.month - 1];

  // A pick from another month (kept while that month loads) falls back to today, or the 1st.
  const selected = picked?.startsWith(currentMonth)
    ? picked
    : today.startsWith(currentMonth)
      ? today
      : monthStart;

  const grid = monthGrid(view);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of [...events].sort(compareEvents)) {
    for (const day of eventDays(event)) {
      const list = eventsByDay.get(day);
      if (list) list.push(event);
      else eventsByDay.set(day, [event]);
    }
  }

  // Feb 29 birthdays are celebrated on the 28th in common years.
  const birthdayOf = (celebrant: Celebrant) =>
    makeDayKey(view.year, view.month, Math.min(celebrant.day, lastDate));

  // The grid shows what members see, so admins can check the effect of hiding someone.
  const visibleCelebrants = shownCelebrants.filter((celebrant) => !celebrant.hidden);
  const celebrantsByDay = new Map<string, Celebrant[]>();
  for (const celebrant of visibleCelebrants) {
    const day = birthdayOf(celebrant);
    celebrantsByDay.set(day, [...(celebrantsByDay.get(day) ?? []), celebrant]);
  }

  const monthEvents = events
    .filter((event) => eventStartDay(event) <= monthEnd && eventEndDay(event) >= monthStart)
    .sort((a, b) => eventStartDay(a).localeCompare(eventStartDay(b)) || compareEvents(a, b));

  const holidayCount = monthEvents.filter((event) => event.tag === "HOLIDAY").length;
  const selectedEvents = eventsByDay.get(selected) ?? [];
  const selectedCelebrants = celebrantsByDay.get(selected) ?? [];

  const stats = [
    { label: "Events", value: monthEvents.length - holidayCount, tone: "event" },
    { label: "Holidays", value: holidayCount, tone: "holiday" },
    { label: "Birthdays", value: visibleCelebrants.length, tone: "birthday" },
  ];

  function goToMonth(target: MonthView, select?: string) {
    const targetKey = monthKey(target);
    if (targetKey === currentMonth) return;
    if (select) setPicked(select);
    setSlide(targetKey > currentMonth ? "next" : "prev");
    setFailedMonth(null);
    setView(target);
    // Only the address changes; the month's data comes from the cache or straight from Supabase.
    window.history.pushState(null, "", `?month=${targetKey}`);
  }

  function selectDay(day: string) {
    if (day.startsWith(currentMonth)) setPicked(day);
    else goToMonth(monthOfDay(day), day);
  }

  function goToday() {
    if (today.startsWith(currentMonth)) setPicked(today);
    else goToMonth(monthOfDay(today), today);
  }

  function changeVisibility(userIds: string[], visible: boolean) {
    setVisibilityError("");
    startVisibility(async () => {
      applyVisibility({ userIds, hidden: !visible });
      const result = await setBirthdayVisibility(userIds, visible);
      if (!result.success) setVisibilityError(result.error ?? "Couldn't update birthday visibility.");
    });
  }

  // Left / right flip months and T jumps to today, like Calendar on a Mac.
  useEffect(() => {
    if (editing || deleting) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft") goToMonth(shiftMonth(view, -1));
      else if (e.key === "ArrowRight") goToMonth(shiftMonth(view, 1));
      else if (e.key === "t" || e.key === "T") goToday();
      else return;
      e.preventDefault();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function saveEventOptimistic(input: EventInput, preview: Omit<CalendarEvent, "id">, original?: CalendarEvent) {
    startEventChange(async () => {
      // New events get a placeholder id until the refresh brings the real row.
      applyEventChange({ type: "save", event: { ...preview, id: input.id ?? -Date.now() } });
      const result = await settle(saveEvent(input));
      if (result.error === undefined) return;
      // Reopen the modal with what they typed, so nothing is lost.
      setEditing({
        event: original,
        draft: input,
        error: result.error || SAVE_ERROR,
        fieldErrors: "fieldErrors" in result ? result.fieldErrors : undefined,
      });
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startEventChange(async () => {
      applyEventChange({ type: "delete", id: target.id });
      const result = await settle(deleteEvent(target.id));
      // The optimistic removal ends with the transition, so the event comes back on its own.
      if (result.error !== undefined) toast(`Couldn't delete "${target.name}". It's back on the calendar.`);
    });
  }

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
        <div className="calHero">
          <div className="calHeroMain">
            <span className="eyebrow calHeroEyebrow">SOE HUB / SCHOOL CALENDAR</span>
            <h1>
              WHAT&apos;S ON
            </h1>
            <div className="calHeroRule">
              <span className="mono calHeroDate">
                <span className="calLiveDot" aria-hidden="true" />
                TODAY · {formatLongDay(today).toUpperCase()} {today.slice(0, 4)}
              </span>
            </div>

            <ul className="calStats" aria-label={`${monthName} at a glance`}>
              {stats.map((stat, index) => (
                <li
                  key={stat.label}
                  className={`calStat tone-${stat.tone}`}
                  style={{ animationDelay: `${0.12 + index * 0.07}s` }}
                >
                  <span key={`${currentMonth}-${stat.value}`} className="calStatValue">
                    {String(stat.value).padStart(2, "0")}
                  </span>
                  <span className="mono calStatLabel">
                    {stat.label}
                    <span className="calStatMonth"> in {monthName.slice(0, 3)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="calHeroSide">
            <UpNext event={nextEvent} today={today} onSelectDay={selectDay} onEnded={refreshNextEvent} />
          </div>
        </div>

        <div className="calLayout">
          <div className="calMain">
            <section
              className={`calWindow tick-frame${loading ? " isLoading" : ""}`}
              aria-busy={loading}
              aria-label={`${monthName} ${view.year}`}
            >
              <span className="tick-bl" />
              <span className="tick-br" />

              <div className="calToolbar">
                <h2 key={currentMonth} className={`calTitle${slide ? ` slide-${slide}` : ""}`}>
                  <strong>{monthName}</strong> {view.year}
                </h2>

                <div className="calToolbarActions">
                  {isAdmin && (
                    <button type="button" className="btn calAddBtn" onClick={() => setEditing({})} aria-label="Add event">
                      <PlusIcon />
                      <span className="calAddLabel">Add event</span>
                    </button>
                  )}
                  <div className="calSegment" role="group" aria-label="Change month">
                    <button
                      type="button"
                      onClick={() => goToMonth(shiftMonth(view, -1))}
                      aria-label={`Previous month, ${MONTH_NAMES[shiftMonth(view, -1).month - 1]}`}
                    >
                      <ChevronIcon direction="left" />
                    </button>
                    <button
                      type="button"
                      className="calTodayBtn"
                      onClick={goToday}
                      title="Shortcuts: ← and → change month, T jumps to today"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => goToMonth(shiftMonth(view, 1))}
                      aria-label={`Next month, ${MONTH_NAMES[shiftMonth(view, 1).month - 1]}`}
                    >
                      <ChevronIcon direction="right" />
                    </button>
                  </div>
                </div>
              </div>

              <ul className="calLegend" aria-label="Legend">
                {EVENT_TAGS.map((tag) => (
                  <li key={tag} className={`tone-${tag.toLowerCase()}`}>
                    <i aria-hidden="true" />
                    {TAG_LABELS[tag]}
                  </li>
                ))}
                <li className="tone-birthday">
                  <i aria-hidden="true" />
                  Birthday
                </li>
                {isAdmin && <li className="calLegendHint">Double-click a day to add an event</li>}
              </ul>

              {failedMonth === currentMonth && (
                <p className="calLoadError" role="alert">
                  Couldn&apos;t load {monthName}.
                  <button type="button" onClick={() => setFailedMonth(null)}>
                    Try again
                  </button>
                </p>
              )}

              <div className="calWeekdays" aria-hidden="true">
                {WEEKDAY_NAMES.map((name, index) => (
                  <span key={name} className={index === 0 || index === 6 ? "isWeekend" : undefined}>
                    <span className="calWdFull">{name}</span>
                    <span className="calWdShort">{name.charAt(0)}</span>
                  </span>
                ))}
              </div>

              <div key={currentMonth} className={`calGrid${slide ? ` slide-${slide}` : ""}`}>
                {grid.map((day) => {
                  const dayEvents = eventsByDay.get(day) ?? [];
                  const dayCelebrants = day.startsWith(currentMonth) ? celebrantsByDay.get(day) ?? [] : [];
                  const inMonth = day.startsWith(currentMonth);
                  const weekday = weekdayOf(day);
                  const isHoliday = dayEvents.some((event) => event.tag === "HOLIDAY");
                  const hidden = dayEvents.length - MAX_PILLS;

                  const classes = ["calCell"];
                  if (!inMonth) classes.push("isOutside");
                  if (weekday === 0 || weekday === 6) classes.push("isWeekend");
                  if (isHoliday) classes.push("isHoliday");
                  if (dayEvents.length) classes.push("hasEvents");
                  if (day === today) classes.push("isToday");
                  if (day === selected) classes.push("isSelected");

                  const summary = [
                    dayEvents.length ? `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : "",
                    isHoliday ? "holiday" : "",
                    dayCelebrants.length ? `${dayCelebrants.length} birthday${dayCelebrants.length > 1 ? "s" : ""}` : "",
                  ].filter(Boolean);

                  return (
                    <button
                      key={day}
                      type="button"
                      className={classes.join(" ")}
                      onClick={() => selectDay(day)}
                      onDoubleClick={isAdmin && inMonth ? () => setEditing({}) : undefined}
                      aria-pressed={day === selected}
                      aria-current={day === today ? "date" : undefined}
                      aria-label={`${formatLongDay(day)}${day === today ? ", today" : ""}${
                        summary.length ? ` — ${summary.join(", ")}` : ""
                      }`}
                    >
                      <span className="calCellHead">
                        {dayCelebrants.length > 0 && (
                          <span className="calCake" title={dayCelebrants.map((c) => c.name).join(", ")}>
                            <CakeIcon />
                          </span>
                        )}
                        <span className="calDayNum">
                          {dayOf(day) === 1 && (
                            <span className="calDayMonth">{MONTH_NAMES[Number(day.slice(5, 7)) - 1].slice(0, 3)}&nbsp;</span>
                          )}
                          {dayOf(day)}
                        </span>
                      </span>

                      <span className="calPills">
                        {dayEvents.slice(0, hidden > 0 ? MAX_PILLS - 1 : MAX_PILLS).map((event) => {
                          const bar = event.allDay || eventStartDay(event) !== eventEndDay(event);
                          const pillClasses = ["calPill", `tone-${event.tag.toLowerCase()}`];
                          if (bar) pillClasses.push("isBar");
                          if (bar && day !== eventStartDay(event) && weekday !== 0) pillClasses.push("joinsBefore");
                          if (bar && day !== eventEndDay(event) && weekday !== 6) pillClasses.push("joinsAfter");

                          return (
                            <span
                              key={event.id}
                              className={pillClasses.join(" ")}
                              title={`${event.name} · ${bar ? formatEventDates(event) : formatTime(event.start)}`}
                            >
                              {!bar && <i className="calPillDot" aria-hidden="true" />}
                              <span className="calPillName">{event.name}</span>
                            </span>
                          );
                        })}
                        {hidden > 0 && <span className="calMore">{hidden + 1} more</span>}
                      </span>

                      {/* Phones only have room for coloured dots. */}
                      {(dayEvents.length > 0 || dayCelebrants.length > 0) && (
                        <span className="calDots" aria-hidden="true">
                          {dayEvents.slice(0, 3).map((event) => (
                            <i key={event.id} className={`tone-${event.tag.toLowerCase()}`} />
                          ))}
                          {dayCelebrants.length > 0 && <i className="tone-birthday" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="calAgenda" aria-live="polite">
                <div className="calAgendaHead">
                  <div>
                    <span className="mono calAgendaEyebrow">
                      {selected === today ? "TODAY" : "SELECTED DAY"}
                    </span>
                    <h3>{formatLongDay(selected)}</h3>
                  </div>
                  {isAdmin && (
                    <button type="button" className="btn ghost calAgendaAdd" onClick={() => setEditing({})}>
                      <PlusIcon />
                      Add on this day
                    </button>
                  )}
                </div>

                {selectedEvents.length === 0 && selectedCelebrants.length === 0 ? (
                  <p className="calEmpty">Nothing scheduled for this day.</p>
                ) : (
                  <ul className="calAgendaList">
                    {selectedEvents.map((event, index) => (
                      <li
                        key={`${selected}-${event.id}`}
                        className={`calAgendaItem tone-${event.tag.toLowerCase()}`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <span className="calAgendaTime mono">
                          {eventStartDay(event) !== eventEndDay(event) ? formatEventDates(event) : formatEventTime(event)}
                        </span>
                        <div className="calAgendaBody">
                          <div className="calAgendaTitleRow">
                            <strong>{event.name}</strong>
                            <span className="calTagChip">{TAG_LABELS[event.tag]}</span>
                          </div>
                          {eventStartDay(event) !== eventEndDay(event) && !event.allDay && (
                            <span className="calAgendaSub">{formatEventTime(event)}</span>
                          )}
                          {event.description && <EventDescription text={event.description} />}
                        </div>
                        {isAdmin && (
                          <div className="calAgendaActions">
                            <button
                              type="button"
                              className="calIconBtn"
                              onClick={() => setEditing({ event })}
                              aria-label={`Edit ${event.name}`}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              className="calIconBtn isDanger"
                              onClick={() => setDeleting(event)}
                              aria-label={`Delete ${event.name}`}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                    {selectedCelebrants.map((celebrant, index) => (
                      <li
                        key={`${selected}-${celebrant.id}`}
                        className="calAgendaItem tone-birthday"
                        style={{ animationDelay: `${(selectedEvents.length + index) * 50}ms` }}
                      >
                        <span className="calAgendaTime mono">All day</span>
                        <div className="calAgendaBody">
                          <div className="calAgendaTitleRow">
                            <strong>
                              {celebrant.id === profile.id ? "Your birthday!" : `${celebrant.name}'s birthday`}
                            </strong>
                            <span className="calTagChip">Birthday</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <aside className="calSide">
            <BirthdayPanel
              celebrants={shownCelebrants}
              dayOf={birthdayOf}
              today={today}
              monthName={monthName}
              currentUserId={profile.id}
              isAdmin={isAdmin}
              saving={visibilityPending}
              error={visibilityError}
              onSelectDay={selectDay}
              onChangeVisibility={changeVisibility}
            />

            <section className="calSideBlock tick-frame">
              <span className="tick-bl" />
              <span className="tick-br" />
              <div className="calSectionHead">
                <span className="mono calSectionLabel">
                  <span className="calSectionNum">02</span> This month&apos;s events
                </span>
                <span className="mono calSectionMeta">{monthEvents.length}</span>
              </div>

              {monthEvents.length === 0 ? (
                <p className="calSideEmpty">
                  <span className="calSideEmptyIcon">
                    <CalendarIcon />
                  </span>
                  Nothing scheduled for {monthName} yet.
                </p>
              ) : (
                <ul className="calBullets">
                  {monthEvents.map((event) => {
                    // Events that began last month jump to the 1st instead.
                    const target = eventStartDay(event) < monthStart ? monthStart : eventStartDay(event);
                    return (
                      <li key={event.id} className={`tone-${event.tag.toLowerCase()}`}>
                        <button type="button" onClick={() => selectDay(target)}>
                          <span className="mono calBulletDate">{formatEventDates(event).toUpperCase()}</span>
                          <span className="calBulletName">{event.name}</span>
                          <span className="calBulletMeta">
                            {TAG_LABELS[event.tag]} · {formatEventTime(event)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {editing && (
        <EventModal
          event={editing.event}
          draft={editing.draft}
          initialError={editing.error}
          initialFieldErrors={editing.fieldErrors}
          defaultDay={selected}
          onClose={() => setEditing(null)}
          onSave={(input, preview) => saveEventOptimistic(input, preview, editing.event)}
        />
      )}

      {deleting && (
        <DeleteEventDialog
          event={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
          onDeleted={() => setDeleting(null)}
        />
      )}

      <style jsx global>{`
        /* ---------- Event colours (one per tag, plus birthdays) ---------- */
        .tone-event {
          --tone: #2e5c8a;
          --tone-tint: #e1eaf4;
        }

        .tone-academic {
          --tone: #2a7468;
          --tone-tint: #dcefea;
        }

        .tone-deadline {
          --tone: #d9531e;
          --tone-tint: #fcebdf;
        }

        .tone-holiday {
          --tone: #b3261e;
          --tone-tint: #fbe6e3;
        }

        .tone-birthday {
          --tone: #a8427a;
          --tone-tint: #f7e3ee;
        }

        /* ---------- Hero ---------- */
        /* Same columns as .calLayout, so the countdown lines up with the sidebar below it;
           tops aligned so it starts level with the eyebrow. */
        .calHero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 28px;
          align-items: start;
          margin-bottom: 28px;
        }

        .calHeroMain {
          min-width: 0;
          animation: fadeInUp 0.5s ease backwards;
        }

        .calStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
          list-style: none;
        }

        .calStat {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 10px 14px 11px;
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          overflow: hidden;
          animation: fadeInUp 0.45s ease backwards;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .calStat::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--tone);
        }

        .calStat:hover {
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--tone);
        }

        .calStatValue {
          font-family: "Space Grotesk", sans-serif;
          font-size: var(--fs-stat);
          font-weight: 700;
          line-height: 1;
          color: var(--navy-deep);
          font-variant-numeric: tabular-nums;
          animation: calPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        @keyframes calPop {
          from {
            transform: scale(0.6);
            opacity: 0;
          }
        }

        .calStatLabel {
          margin-top: 4px;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--tone);
        }

        .calStatMonth {
          color: var(--ink-soft);
        }

        .calHeroSide {
          min-width: 0;
        }

        .calHeroEyebrow {
          margin-bottom: 8px;
          letter-spacing: 0.08em;
        }

        .calHero h1 {
          font-size: var(--fs-display);
          margin-bottom: 0;
          line-height: 1;
        }

        .calHeroRule {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 14px;
        }

        .calHeroRule::after {
          content: "";
          flex: 1;
          border-top: 1px solid #c9bfa0;
        }

        .calHeroDate {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
        }

        .calLiveDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--orange);
          animation: calPulse 2s ease-out infinite;
        }

        @keyframes calPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(217, 83, 30, 0.5);
          }
          70%,
          100% {
            box-shadow: 0 0 0 7px rgba(217, 83, 30, 0);
          }
        }

        .calLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 28px;
          align-items: start;
        }

        .calMain {
          min-width: 0;
        }

        /* ---------- Calendar window ---------- */
        .calWindow.tick-frame {
          padding: 0;
          border-radius: 10px;
          box-shadow: 0 1px 0 rgba(13, 30, 56, 0.04), 0 14px 32px -18px rgba(13, 30, 56, 0.35);
          animation: fadeInUp 0.45s ease backwards;
          animation-delay: 0.05s;
        }

        .calToolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding: 20px 20px 10px;
        }

        .calTitle {
          margin: 0;
          font-size: var(--fs-section);
          line-height: 1.1;
          font-weight: 400;
          color: var(--ink-soft);
        }

        .calTitle strong {
          font-weight: 700;
          color: var(--navy-deep);
        }

        /* A quick nudge from the side the new month arrives from. */
        .calTitle.slide-next,
        .calGrid.slide-next {
          animation: calInFromRight 0.16s ease-out;
        }

        .calTitle.slide-prev,
        .calGrid.slide-prev {
          animation: calInFromLeft 0.16s ease-out;
        }

        @keyframes calInFromRight {
          from {
            opacity: 0.4;
            transform: translateX(10px);
          }
        }

        @keyframes calInFromLeft {
          from {
            opacity: 0.4;
            transform: translateX(-10px);
          }
        }

        .calToolbarActions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .calAddBtn {
          padding: 7px 14px;
          font-size: 13px;
          gap: 6px;
          white-space: nowrap;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .calAddBtn:not(:disabled):hover {
          background: var(--navy-deep);
          box-shadow: 0 2px 6px rgba(19, 42, 77, 0.18);
        }

        .calAddBtn:not(:disabled):active {
          transform: scale(0.98);
          box-shadow: none;
        }

        /* "‹ Today ›" segmented control. */
        .calSegment {
          display: inline-flex;
          border: 1px solid #c9bfa0;
          border-radius: 6px;
          background: var(--white);
          overflow: hidden;
          box-shadow: 0 1px 0 rgba(13, 30, 56, 0.05);
        }

        .calSegment button {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 32px;
          padding: 0 8px;
          border: none;
          background: none;
          color: var(--navy);
          font-family: "Inter", sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .calSegment button + button {
          border-left: 1px solid #c9bfa0;
        }

        .calSegment .calTodayBtn {
          padding: 0 14px;
        }

        .calSegment button:hover {
          background: var(--vellum);
        }

        .calSegment button:active {
          background: var(--vellum-2);
        }

        .calSegment button:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .calLegend {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 14px;
          list-style: none;
          padding: 0 20px 12px;
          font-size: 11.5px;
          color: var(--ink-soft);
        }

        .calLegend li {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .calLegend .calLegendHint {
          margin-left: auto;
          font-style: italic;
        }

        .calLegend i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--tone);
        }

        .calWeekdays {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          border-top: 1px solid var(--rule-soft);
        }

        .calWeekdays > span {
          padding: 6px 10px;
          text-align: right;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--ink-soft);
        }

        .calWeekdays > span.isWeekend {
          color: #8a8f9c;
        }

        .calWdShort {
          display: none;
        }

        /* Hairlines between days come from the 1px gap over a tinted background. */
        .calGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 1px;
          background: var(--rule-soft);
          border-top: 1px solid var(--rule-soft);
          border-bottom: 1px solid var(--rule-soft);
          transition: opacity 0.15s ease;
        }

        .calWindow.isLoading .calGrid {
          opacity: 0.6;
        }

        .calLoadError {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 20px 12px;
          padding: 8px 12px;
          border-radius: 5px;
          background: #fbe9e7;
          font-size: 12.5px;
          color: #b3261e;
        }

        .calLoadError button {
          border: none;
          background: none;
          padding: 0;
          font: inherit;
          font-weight: 600;
          color: inherit;
          text-decoration: underline;
          cursor: pointer;
        }

        .calCell {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          min-height: 108px;
          padding: 5px 5px 6px;
          border: none;
          background: var(--white);
          text-align: left;
          font: inherit;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .calCell.isWeekend {
          background: #f7f4ec;
        }

        /* Blueprint-style hatching marks a day off. */
        .calCell.isHoliday {
          background: repeating-linear-gradient(135deg, #fbe6e3 0 7px, #f8dad5 7px 14px);
        }

        .calCell:hover {
          background: #f1ede2;
        }

        .calCell.isHoliday:hover {
          background: #f8dcd8;
        }

        .calCell.isSelected {
          box-shadow: inset 0 0 0 2px var(--navy);
          z-index: 1;
        }

        .calCell:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--blue), inset 0 0 0 4px rgba(46, 92, 138, 0.2);
          z-index: 2;
        }

        .calCellHead {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          min-height: 24px;
        }

        .calCake {
          margin-right: auto;
          margin-left: 3px;
          color: #a8427a;
          display: flex;
        }

        .calDayNum {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 6px;
          border-radius: 999px;
          font-family: "Space Grotesk", sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: var(--ink);
        }

        .calCell.isOutside .calDayNum,
        .calCell.isOutside .calPills {
          opacity: 0.4;
        }

        .calCell.isHoliday .calDayNum {
          color: #b3261e;
          font-weight: 600;
        }

        /* Today: the filled circle, in the portal's orange. */
        .calCell.isToday .calDayNum {
          background: var(--orange);
          color: var(--white);
          font-weight: 600;
          animation: calTodayPulse 2.4s ease-out infinite;
        }

        @keyframes calTodayPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(217, 83, 30, 0.45);
          }
          70%,
          100% {
            box-shadow: 0 0 0 7px rgba(217, 83, 30, 0);
          }
        }

        .calCell.hasEvents:hover .calPill {
          transform: translateX(1px);
        }

        .calPill {
          transition: transform 0.15s ease;
        }

        .calPills {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .calPill {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 11.5px;
          line-height: 1.45;
        }

        .calPillDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--tone);
          flex-shrink: 0;
        }

        .calPillName {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        /* All-day and multi-day events: tinted bars that join across neighbouring days. */
        .calPill.isBar {
          background: var(--tone-tint);
          color: var(--tone);
          font-weight: 600;
          box-shadow: inset 3px 0 0 var(--tone);
        }

        .calPill.isBar.joinsBefore {
          margin-left: -6px;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          box-shadow: none;
        }

        .calPill.isBar.joinsAfter {
          margin-right: -6px;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }

        .calMore {
          padding: 0 5px;
          font-size: 11px;
          font-weight: 600;
          color: var(--ink-soft);
        }

        .calDots {
          display: none;
        }

        /* ---------- Selected day ---------- */
        .calAgenda {
          padding: 16px 20px 20px;
        }

        .calAgendaHead {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .calAgendaEyebrow {
          display: block;
          font-size: 10.5px;
          letter-spacing: 0.1em;
          color: var(--orange);
        }

        .calAgendaHead h3 {
          margin: 2px 0 0;
          font-size: 19px;
        }

        .calAgendaAdd {
          padding: 6px 12px;
          font-size: 12.5px;
          gap: 6px;
          white-space: nowrap;
        }

        .calEmpty {
          margin: 0;
          padding: 14px 16px;
          border: 1px dashed #c9bfa0;
          border-radius: 6px;
          background: var(--vellum);
          font-size: 13px;
          color: var(--ink-soft);
        }

        .calAgendaList {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .calAgendaItem {
          display: grid;
          grid-template-columns: 136px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: start;
          padding: 10px 12px 10px 14px;
          border: 1px solid var(--rule-soft);
          border-left: 3px solid var(--tone);
          border-radius: 6px;
          background: var(--white);
          animation: fadeInUp 0.25s ease backwards;
        }

        .calAgendaTime {
          padding-top: 2px;
          font-size: 11.5px;
          color: var(--ink-soft);
        }

        .calAgendaTitleRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px 8px;
        }

        .calAgendaTitleRow strong {
          font-size: 14px;
          font-weight: 600;
          color: var(--navy-deep);
          overflow-wrap: anywhere;
        }

        .calTagChip {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 1px 6px;
          border-radius: 3px;
          background: var(--tone-tint);
          color: var(--tone);
        }

        .calAgendaSub {
          display: block;
          margin-top: 2px;
          font-size: 12px;
          color: var(--ink-soft);
        }

        /* Long details are cut to three lines until "Show more" is clicked. */
        .calAgendaDesc {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--ink-soft);
          white-space: pre-line;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          overflow: hidden;
        }

        .calAgendaDesc.isExpanded {
          display: block;
          -webkit-line-clamp: unset;
          line-clamp: none;
          overflow: visible;
        }

        .calDescToggle {
          margin-top: 2px;
          padding: 0;
          border: none;
          background: none;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          color: var(--blue);
          cursor: pointer;
        }

        .calDescToggle:hover {
          color: var(--navy);
          text-decoration: underline;
        }

        .calDescToggle:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
          border-radius: 2px;
        }

        .calAgendaActions {
          display: flex;
          gap: 2px;
        }

        .calIconBtn {
          display: flex;
          padding: 6px;
          border: none;
          border-radius: 4px;
          background: none;
          color: var(--ink-soft);
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .calIconBtn:hover {
          background: var(--vellum);
          color: var(--navy);
        }

        .calIconBtn.isDanger:hover {
          background: #fbe9e7;
          color: #b3261e;
        }

        .calIconBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 1px;
        }

        /* ---------- Sidebar ---------- */
        .calSide {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .calSideBlock {
          animation: fadeInUp 0.4s ease backwards;
        }

        .calSideBlock:nth-of-type(2) {
          animation-delay: 0.08s;
        }

        .calSectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #c9bfa0;
        }

        .calSectionLabel {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
        }

        .calSectionNum {
          color: var(--orange);
          margin-right: 6px;
        }

        .calSectionMeta {
          font-size: 10.5px;
          color: var(--ink-soft);
          padding: 1px 8px;
          background: var(--vellum);
          border: 1px solid var(--rule-soft);
          border-radius: 999px;
          white-space: nowrap;
        }

        .calSideEmpty {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 14px 0 0;
          font-size: 13px;
          color: var(--ink-soft);
        }

        .calSideEmptyIcon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px dashed #c9bfa0;
          background: var(--vellum);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Real bullets, coloured by tag. */
        .calBullets {
          margin-top: 10px;
          padding-left: 18px;
        }

        .calBullets li {
          padding: 3px 0;
        }

        .calBullets li::marker {
          color: var(--tone);
          font-size: 1.2em;
        }

        .calBullets button {
          display: flex;
          flex-direction: column;
          width: 100%;
          padding: 3px 6px;
          border: none;
          border-radius: 5px;
          background: none;
          font: inherit;
          text-align: left;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s ease, transform 0.15s ease;
        }

        .calBullets button:hover {
          background: var(--vellum);
          transform: translateX(3px);
        }

        .calBullets button:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: -2px;
        }

        .calBulletDate {
          font-size: 10.5px;
          letter-spacing: 0.04em;
          color: var(--tone);
        }

        .calBulletName {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--navy-deep);
          overflow-wrap: anywhere;
        }

        .calBulletMeta {
          font-size: 12px;
          color: var(--ink-soft);
        }

        /* ---------- Responsive ---------- */
        @media (max-width: 900px) {
          .calLayout,
          .calHero {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 640px) {
          .calAddBtn {
            padding: 7px 8px;
          }

          .calAddLabel {
            display: none;
          }

          .calToolbar {
            padding: 14px 14px 8px;
          }

          .calLegendHint,
          .calStatMonth {
            display: none;
          }

          .calStats {
            gap: 8px;
          }

          .calLegend {
            padding: 0 14px 10px;
          }

          .calWdFull {
            display: none;
          }

          .calWdShort {
            display: inline;
          }

          .calWeekdays > span {
            text-align: center;
            padding: 6px 0;
          }

          .calCell {
            min-height: 58px;
            align-items: center;
            padding: 4px 2px;
          }

          .calCellHead {
            justify-content: center;
          }

          .calCake,
          .calDayMonth {
            display: none;
          }

          .calDayNum {
            font-size: 13px;
            padding: 0;
            width: 26px;
            height: 26px;
          }

          .calPills {
            display: none;
          }

          .calDots {
            display: flex;
            gap: 3px;
          }

          .calDots i {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: var(--tone);
          }

          .calAgenda {
            padding: 14px;
          }

          .calAgendaItem {
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .calAgendaTime {
            grid-column: 1 / -1;
            padding-top: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .calLiveDot,
          .calCell.isToday .calDayNum,
          .calTitle,
          .calGrid,
          .calStat,
          .calStatValue {
            animation: none;
          }

          .calStat,
          .calPill,
          .calBullets button {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

/** An event's details, cut to three lines with a toggle when they run longer. */
function EventDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Only offer "Show more" when the clamp is actually hiding something; recheck on resize.
  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  // Several blank lines in a row add nothing but height.
  const tidy = text.replace(/\n{3,}/g, "\n\n");

  return (
    <>
      <p ref={ref} className={`calAgendaDesc${expanded ? " isExpanded" : ""}`}>
        {tidy}
      </p>
      {(overflows || expanded) && (
        <button type="button" className="calDescToggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
