"use client";

export const instant = false;

import Image from "next/image";
import Link from "next/link";
import AnnouncementCard from "./AnnouncementCard";
import Select from "@/components/Select";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client"
import { useRouter } from "next/navigation";

export type User = {
  id: string;
  name: string;
  initials: string;
  isAdmin?: AdminRole;
};

type AdminRole = {
  role: string;
}

type VideoMedia = {
  url: string;
  type: "video";
  label: string;
  duration: string;
}

type ImageMedia = {
  url: string;
  type: "image";
  items: Images[]
}

type Images = {
  src: string; 
  alt: string
}


export type Announcement = {
  id: string;
  tag: string;
  postedAt: string;
  authorId: string;
  title: string;
  body: string;
  media?: VideoMedia | ImageMedia;
  reactedBy: string[];
};

type TagKey = "FINANCE" | "EVENT" | "ACADEMIC" | "TRANSPARENCY" | "GENERAL"

type Tag = {
  key: TagKey;
  label: string;
};

const ANNOUNCEMENTS: Announcement[] = [];

const Tags: Tag[] = [];

function formatDateLine(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${weekday}, ${month} ${date.getDate()} ${date.getFullYear()}`;
}

type HomeContentProps = {
  current_user: User;
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // If the date is invalid or in the future
  if (isNaN(diffInSeconds) || diffInSeconds < 0) return "Just now";

  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (diffInSeconds < 60) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

export async function getAdmin(announcement_id: string): Promise<User> {
  const supabase = createClient();
  const { data: adminUser, error: adminError } = await supabase
    .from("announcements")
    .select("id, author_id")
    .eq("id", announcement_id)
    .single()
  
    if (adminError) throw adminError;

    return getPerson(adminUser.author_id);
}

export async function getPerson(user_id: string): Promise<User> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq("id", user_id)
    .single();

  if (userError) throw userError;

  const firstName = userData.first_name ?? "";
  const lastName = userData.last_name ?? "";
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();

  return {
    id: userData.id,
    name: `${firstName} ${lastName}`.trim(),
    initials,
  };
}

export default function HomeContent({current_user}: HomeContentProps) {
  const [dateLine, setDateLine] = useState("");
  var [announcements, setAnnouncements] = useState<Announcement[]>(ANNOUNCEMENTS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const pendingReactionIds = useRef(new Set<string>());
  const supabase = createClient();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>(Tags);
  const [activeTag, setActiveTag] = useState<TagKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");


  useEffect(() => {
    setDateLine(formatDateLine(new Date()));
    const loadAnnouncements = async() => {
      try {
        setCurrentUser(current_user);

        const { data: announcementData, error: announcementError } = await supabase
          .from("announcements")
          .select("id, tag, title, content, created_at, media, author_id");
      
        if (announcementError) {
          console.error("Error fetching announcements:", announcementError);
          return;
        };

        const { data: announcementReacts, error: reactsError } = await supabase
          .from("announcement_reactions")
          .select("announcement_id, user_id")

        if (reactsError) throw reactsError;

        const loadedAnnouncements: Announcement[] = (announcementData || []).map((row) => ({
          id: row.id,
          tag: row.tag,
          postedAt: row.created_at,
          title: row.title,
          body: row.content,
          authorId: row.author_id || undefined,
          media: row.media || undefined,
          reactedBy: (announcementReacts || [])
            .filter((reaction) => reaction.announcement_id === row.id)
            .map((reaction) => reaction.user_id),
        }));

        console.log(loadedAnnouncements);

        const loadedTags = (announcementData || []).map((row) => ({
          key: row.tag,
          label: row.tag
        }));

        setTags(loadedTags)
        setAnnouncements(loadedAnnouncements);

      
      
      } catch (err) {
        console.error(err);
      };
    };

    loadAnnouncements();
  }, []);

  const visibleAnnouncements = announcements.filter((a) => {
    const matchesTag = activeTag === "all" || a.tag === activeTag;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = q === "" || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
    return matchesTag && matchesQuery;
  });

  async function handleToggleReaction(postId: string) {
    if (!currentUser || pendingReactionIds.current.has(postId)) return;

    const announcement = announcements.find((item) => item.id === postId);
    if (!announcement) return;

    pendingReactionIds.current.add(postId);
    const hasReacted = announcement.reactedBy.includes(currentUser.id);

    try {
      const result = hasReacted
        ? await supabase
            .from("announcement_reactions")
            .delete()
            .eq("announcement_id", postId)
            .eq("user_id", currentUser.id)
        : await supabase
            .from("announcement_reactions")
            .insert({ announcement_id: postId, user_id: currentUser.id });

      if (result.error) throw result.error;

      setAnnouncements((current) =>
        current.map((item) => {
          if (item.id !== postId) return item;

          return {
            ...item,
            reactedBy: hasReacted
              ? item.reactedBy.filter((userId) => userId !== currentUser.id)
              : [...item.reactedBy, currentUser.id],
          };
        })
      );
    } catch (error) {
      console.error("Error toggling announcement reaction:", error);
    } finally {
      pendingReactionIds.current.delete(postId);
    }
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
          <Link href="#">Transparency Reports</Link>
        </nav>
        <Link href="#" className="user-chip">
          <span className="dot">{current_user.initials}</span> {current_user.name}
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

              {!currentUser ? null : visibleAnnouncements.length === 0 ? (
                <p className="emptyState">No announcements match your search.</p>
              ) : (
                visibleAnnouncements.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    announcement={item}
                    currentUser={currentUser}
                    onToggleReaction={handleToggleReaction}
                  />
                ))
              )}
            </div>

            
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
        }

        .socialLinks svg {
          display: block;
        }

        .socialLinks a:hover {
          background: var(--blue);
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 28px;
          align-items: start;
        }

        .announceItem {
          padding: 28px 0;
          border-top: 1px solid #c9bfa0;
        }

        .announceItem:first-child {
          border-top: none;
          padding-top: 0;
        }

        .announceItem h3 {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .announceMeta {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--ink-soft);
          margin-bottom: 8px;
        }

        .announceMeta .mono {
          font-family: "IBM Plex Mono", monospace;
        }

        .announceItem p {
          font-size: 14px;
          color: var(--ink);
          margin-bottom: 0;
        }

        .media {
          margin-top: 12px;
          border: 1px solid #c9bfa0;
          background: var(--vellum-2);
          overflow: hidden;
        }

        .mediaImage {
          display: block;
          width: 100%;
          height: auto;
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