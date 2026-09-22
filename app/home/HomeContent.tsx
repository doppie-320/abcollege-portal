"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import AnnouncementCard from "./AnnouncementCard";
import Select from "@/components/Select";
import {
  CURRENT_USER,
  addComment,
  fetchAnnouncements,
  fetchTags,
  toggleReaction,
  type Announcement,
  type TagKey,
} from "@/lib/mock/social-db";

function formatDateLine(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${weekday}, ${month} ${date.getDate()} ${date.getFullYear()}`;
}

export default function HomeContent() {
  const [dateLine, setDateLine] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => fetchAnnouncements());
  const [tags] = useState(() => fetchTags());
  const [activeTag, setActiveTag] = useState<TagKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setDateLine(formatDateLine(new Date()));
  }, []);

  const visibleAnnouncements = announcements.filter((a) => {
    const matchesTag = activeTag === "all" || a.tag === activeTag;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = q === "" || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
    return matchesTag && matchesQuery;
  });

  function handleToggleReaction(postId: string) {
    setAnnouncements(toggleReaction(postId, CURRENT_USER.id));
  }

  function handleAddComment(postId: string, body: string) {
    setAnnouncements(addComment(postId, CURRENT_USER.id, body));
  }

  return (
    <>
      <header className="site-header">
        <Link href="/home" className="brand brandLink">
          <Image
            src="/logo.png"
            alt="Andres Bonifacio College seal"
            width={28}
            height={28}
            className="seal"
          />
          SOE HUB
        </Link>
        <nav className="main-nav">
          <Link href="/home" className="current">Home</Link>
          <Link href="#">Calendar</Link>
          <Link href="#">Attendance</Link>
          <Link href="#">Suggestion Box</Link>
        </nav>
        <Link href="#" className="user-chip">
          <span className="dot">JD</span> Juan Dela Cruz
        </Link>
      </header>
      <div className="header-accent"></div>

      <div className="page-wrap">
        <div className="hero">
          <div className="heroTop">
            <h1>SOE&apos;s HAPPENING</h1>

            <div className="socialLinks">
              <Link href="#" aria-label="SOE on Facebook">
                <FacebookIcon />
              </Link>
              <Link href="#" aria-label="SOE on Messenger">
                <MessengerIcon />
              </Link>
              <Link href="#" aria-label="SOE on Instagram">
                <InstagramIcon />
              </Link>
            </div>
          </div>

          <div className="date mono">{dateLine}</div>
        </div>

        <div className="layout">
          <div className="mainColumn">
            <div className="toolbar tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <div className="toolbarInner">
                <div className="searchWrap">
                  <span className="searchIcon">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    className="searchInput"
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search announcements"
                  />
                </div>
                <div className="tagFilterWrap">
                  <Select
                    id="tagFilter"
                    value={activeTag}
                    onChange={(v) => setActiveTag(v as TagKey | "all")}
                    options={[
                      { value: "all", label: "All" },
                      ...tags.map((tag) => ({ value: tag.key, label: tag.label })),
                    ]}
                    aria-label="Filter announcements by tag"
                    compact
                  />
                </div>
              </div>
            </div>

            <div className="tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>

              {visibleAnnouncements.length === 0 ? (
                <p className="emptyState">No announcements match your search.</p>
              ) : (
                visibleAnnouncements.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    announcement={item}
                    currentUser={CURRENT_USER}
                    onToggleReaction={handleToggleReaction}
                    onAddComment={handleAddComment}
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <h4>Birthdays today</h4>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Today&apos;s celebrants, pulled from the SOE calendar.</p>
              </div>
            </div>

            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <h4>Countdown</h4>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Events within 7 days will count down here.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .brandLink {
          font-size: 16px;
        }

        .seal {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          object-fit: contain;
        }

        .hero {
          margin-bottom: 28px;
          animation: fadeInUp 0.5s ease backwards;
        }

        .heroTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .hero h1 {
          font-size: 44px;
          margin-bottom: 0;
          line-height: 1;
        }

        .date {
          font-size: 13px;
          color: var(--ink-soft);
          margin-top: 4px;
        }

        .socialLinks {
          display: flex;
          gap: 10px;
        }

        .socialLinks a {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .socialLinks svg {
          display: block;
        }

        .socialLinks a:hover {
          background: var(--blue);
          transform: translateY(-3px) rotate(-8deg);
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 28px;
          align-items: start;
        }

        .mainColumn {
          min-width: 0;
        }

        .toolbar {
          padding: 12px 20px;
          margin-bottom: 20px;
          animation: fadeInUp 0.45s ease backwards;
          animation-delay: 0.05s;
        }

        .toolbarInner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .searchWrap {
          position: relative;
          flex: 1;
          max-width: 320px;
        }

        .searchIcon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-soft);
          display: flex;
          pointer-events: none;
        }

        .searchInput {
          width: 100%;
          margin-bottom: 0 !important;
          padding: 8px 12px 8px 32px !important;
          font-size: 13px !important;
          box-shadow: none !important;
        }

        .tagFilterWrap {
          width: 140px;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }

        .emptyState {
          font-size: 13px;
          color: var(--ink-soft);
          padding: 12px 0 0;
          margin-bottom: 0;
        }

        .sideBlock {
          margin-bottom: 22px;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          animation: fadeInUp 0.4s ease backwards;
        }

        .sideBlock:nth-of-type(2) {
          animation-delay: 0.08s;
        }

        .sideBlock:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(19, 42, 77, 0.1);
        }

        .sideBlock:last-child {
          margin-bottom: 0;
        }

        .sideBlock h4 {
          font-size: 14px;
          margin-bottom: 4px;
        }

        .comingSoon {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 22px 0 6px;
          color: var(--ink-soft);
        }

        .comingSoon .badge {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          padding: 3px 7px;
          border: 1px dashed #c9bfa0;
          color: var(--ink-soft);
        }

        .comingSoon p {
          font-size: 12.5px;
          margin: 6px 0 0;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.14 2 11.25c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.92.38 5.52 0 10-4.14 10-9.27S17.52 2 12 2Zm1 12.5-2.55-2.72-4.98 2.72L10.9 8.9l2.62 2.72L18.4 8.9Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
