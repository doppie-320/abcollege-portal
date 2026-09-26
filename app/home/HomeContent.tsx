"use client";

export const instant = false;

import Image from "next/image";
import Link from "next/link";
import AnnouncementCard from "./AnnouncementCard";
import CreatePostModal, { type NewPost } from "./CreatePostModal";
import Select from "@/components/Select";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client"
import { useRouter } from "next/navigation";
import { richTextToPlain } from "@/lib/richText";

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
  comments: Comment[];
};

export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  body: string;
  postedAt: string;
};

type CommentRow = {
  id: string;
  announcement_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    tag: row.tag,
    postedAt: row.created_at,
    title: row.title,
    body: row.content,
    authorId: row.author_id ?? "",
    media: row.media || undefined,
    reactedBy: [],
    comments: [],
  };
}

function toComment(row: CommentRow, author?: UserRow): Comment {
  const firstName = author?.first_name?.trim() ?? "";
  const lastName = author?.last_name?.trim() ?? "";
  return {
    id: row.id,
    authorId: row.user_id,
    authorName: `${firstName} ${lastName}`.trim() || "Unknown",
    authorInitials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?",
    body: row.content,
    postedAt: row.created_at,
  };
}

type TagKey = "FINANCE" | "EVENT" | "ACADEMIC" | "TRANSPARENCY" | "GENERAL"

const POST_TAGS: TagKey[] = ["GENERAL", "ACADEMIC", "EVENT", "FINANCE", "TRANSPARENCY"];

type AnnouncementRow = {
  id: string;
  tag: string;
  title: string;
  content: string;
  created_at: string;
  media: Announcement["media"] | null;
  author_id: string | null;
};

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
  const [showCreatePost, setShowCreatePost] = useState(false);


  useEffect(() => {
    setDateLine(formatDateLine(new Date()));
    const loadAnnouncements = async() => {
      try {
        setCurrentUser(current_user);

        const { data: announcementData, error: announcementError } = await supabase
          .from("announcements")
          .select("id, tag, title, content, created_at, media, author_id")
          .order("created_at", { ascending: false });
      
        if (announcementError) {
          console.error("Error fetching announcements:", announcementError);
          return;
        };

        const { data: announcementReacts, error: reactsError } = await supabase
          .from("announcement_reactions")
          .select("announcement_id, user_id")

        if (reactsError) throw reactsError;

        // Comments are optional: if the table is unavailable, posts still render without them.
        const { data: commentData, error: commentsError } = await supabase
          .from("announcement_comments")
          .select("id, announcement_id, user_id, content, created_at")
          .order("created_at", { ascending: true });

        if (commentsError) console.error("Error fetching announcement comments:", commentsError);

        const commentRows: CommentRow[] = commentData || [];
        const commenterIds = [...new Set(commentRows.map((comment) => comment.user_id))];
        const { data: commenterData } = commenterIds.length
          ? await supabase.from("users").select("id, first_name, last_name").in("id", commenterIds)
          : { data: [] as UserRow[] };
        const commenters = new Map((commenterData || []).map((user: UserRow) => [user.id, user]));

        const loadedAnnouncements: Announcement[] = (announcementData || []).map((row) => ({
          ...toAnnouncement(row),
          reactedBy: (announcementReacts || [])
            .filter((reaction) => reaction.announcement_id === row.id)
            .map((reaction) => reaction.user_id),
          comments: commentRows
            .filter((comment) => comment.announcement_id === row.id)
            .map((comment) => toComment(comment, commenters.get(comment.user_id))),
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
    const matchesQuery =
      q === "" || a.title.toLowerCase().includes(q) || richTextToPlain(a.body).toLowerCase().includes(q);
    return matchesTag && matchesQuery;
  });

  async function handleCreatePost(post: NewPost) {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("announcements")
      .insert({ tag: post.tag, title: post.title, content: post.content, author_id: currentUser.id })
      .select("id, tag, title, content, created_at, media, author_id")
      .single();

    if (error) {
      console.error("Error creating announcement:", error);
      throw error;
    }

    setAnnouncements((current) => [toAnnouncement(data), ...current]);
    addTagOption(post.tag);
  }

  async function handleUpdatePost(postId: string, post: NewPost) {
    const { data, error } = await supabase
      .from("announcements")
      .update({ tag: post.tag, title: post.title, content: post.content })
      .eq("id", postId)
      .select("id, tag, title, content, created_at, media, author_id")
      .single();

    if (error) {
      console.error("Error updating announcement:", error);
      throw error;
    }

    const updated = toAnnouncement(data);
    setAnnouncements((current) =>
      current.map((item) =>
        item.id === postId ? { ...updated, reactedBy: item.reactedBy, comments: item.comments } : item
      )
    );
    addTagOption(post.tag);
  }

  async function handleDeletePost(postId: string) {
    // Select the deleted row back: a delete blocked by RLS returns no error, just no rows.
    const { data, error } = await supabase.from("announcements").delete().eq("id", postId).select("id");

    if (error || !data?.length) {
      console.error("Error deleting announcement:", error ?? "no rows deleted");
      throw error ?? new Error("Announcement was not deleted.");
    }

    setAnnouncements((current) => current.filter((item) => item.id !== postId));
  }

  function addTagOption(tag: string) {
    setTags((current) => (current.some((t) => t.key === tag) ? current : [...current, { key: tag as TagKey, label: tag }]));
  }

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

  async function handleAddComment(postId: string, body: string) {
    if (!currentUser) return;

    const tempId = `temp-${Date.now()}`;
    const pending: Comment = {
      id: tempId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorInitials: currentUser.initials,
      body,
      postedAt: new Date().toISOString(),
    };

    const updateComments = (update: (comments: Comment[]) => Comment[]) =>
      setAnnouncements((current) =>
        current.map((item) => (item.id === postId ? { ...item, comments: update(item.comments) } : item))
      );

    // Show the comment immediately, then swap in the saved row (or roll back on failure).
    updateComments((comments) => [...comments, pending]);

    const { data, error } = await supabase
      .from("announcement_comments")
      .insert({ announcement_id: postId, user_id: currentUser.id, content: body })
      .select("id, announcement_id, user_id, content, created_at")
      .single();

    if (error) {
      console.error("Error adding announcement comment:", error);
      updateComments((comments) => comments.filter((comment) => comment.id !== tempId));
      throw error;
    }

    updateComments((comments) =>
      comments.map((comment) => (comment.id === tempId ? { ...pending, id: data.id, postedAt: data.created_at } : comment))
    );
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
          <span className="dot">{current_user.initials}</span> {current_user.name}
        </Link>
      </header>
      <div className="header-accent"></div>

      <div className="page-wrap">
        <div className="hero">
          <span className="eyebrow heroEyebrow">SOE HUB / BULLETIN BOARD</span>
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

          <div className="heroRule">
            <span className="date mono">{dateLine}</span>
          </div>
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
                <div className="toolbarActions">
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
                  <button type="button" className="btn createPostBtn" onClick={() => setShowCreatePost(true)}>
                    <PlusIcon />
                    Create post
                  </button>
                </div>
              </div>
            </div>

            <div className="tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>

              <div className="sectionHead">
                <span className="mono sectionLabel">Announcements</span>
                <span className="mono sectionMeta">
                  {visibleAnnouncements.length === announcements.length
                    ? `${announcements.length} posted`
                    : `${visibleAnnouncements.length} of ${announcements.length}`}
                </span>
              </div>

              {!currentUser ? null : visibleAnnouncements.length === 0 ? (
                <p className="emptyState">
                  {announcements.length === 0 ? "Nothing has been posted yet." : "No announcements match your search."}
                </p>
              ) : (
                visibleAnnouncements.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    announcement={item}
                    currentUser={currentUser}
                    tags={POST_TAGS}
                    onToggleReaction={handleToggleReaction}
                    onAddComment={handleAddComment}
                    onUpdatePost={handleUpdatePost}
                    onDeletePost={handleDeletePost}
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <div className="sectionHead">
                <span className="mono sectionLabel">01 — Birthdays today</span>
              </div>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Today&apos;s celebrants, pulled from the SOE calendar.</p>
              </div>
            </div>

            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <div className="sectionHead">
                <span className="mono sectionLabel">02 — Countdown</span>
              </div>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Events within 7 days will count down here.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreatePost && currentUser && (
        <CreatePostModal
          currentUser={currentUser}
          tags={POST_TAGS}
          onClose={() => setShowCreatePost(false)}
          onSubmit={handleCreatePost}
        />
      )}

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

        .heroEyebrow {
          margin-bottom: 8px;
          letter-spacing: 0.08em;
        }

        .hero h1 {
          font-size: 44px;
          margin-bottom: 0;
          line-height: 1;
        }

        .heroRule {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 14px;
        }

        .heroRule::after {
          content: "";
          flex: 1;
          border-top: 1px solid #c9bfa0;
        }

        .date {
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--ink-soft);
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
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .socialLinks svg {
          display: block;
        }

        .socialLinks a:hover {
          transform: translate(-1px, -1px);
          box-shadow: 2px 2px 0 var(--orange), 4px 4px 0 var(--yellow);
        }

        .socialLinks a:active {
          transform: none;
          box-shadow: 0 0 0 var(--orange), 0 0 0 var(--yellow);
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

        .toolbarActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .tagFilterWrap {
          width: 140px;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }

        .createPostBtn {
          padding: 7px 14px;
          font-size: 13px;
          gap: 6px;
          white-space: nowrap;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .createPostBtn:hover {
          background: var(--navy-deep);
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--orange), 6px 6px 0 var(--yellow);
        }

        .createPostBtn:active {
          transform: none;
          box-shadow: 0 0 0 var(--orange), 0 0 0 var(--yellow);
        }

        .createPostBtn:focus-visible {
          outline: 2px solid var(--blue);
          outline-offset: 2px;
        }

        @media (max-width: 560px) {
          .toolbarInner {
            flex-wrap: wrap;
          }

          .searchWrap {
            max-width: none;
            flex-basis: 100%;
          }

          .toolbarActions {
            width: 100%;
            justify-content: space-between;
          }
        }

        .sectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #c9bfa0;
        }

        .sectionLabel {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
        }

        .sectionMeta {
          font-size: 11px;
          color: var(--ink-soft);
        }

        .emptyState {
          font-size: 13px;
          color: var(--ink-soft);
          padding: 20px 0 4px;
          margin-bottom: 0;
        }

        .sideBlock {
          margin-bottom: 22px;
          animation: fadeInUp 0.4s ease backwards;
        }

        .sideBlock:nth-of-type(2) {
          animation-delay: 0.08s;
        }

        .sideBlock:last-child {
          margin-bottom: 0;
        }

        .comingSoon {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 16px 0 2px;
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 7.25h2.5v-3.5h-2.5c-2.2 0-3.5 1.5-3.5 3.7v1.8H7.5v3.5H10v7.5h3.5v-7.5H16l.5-3.5h-3V7.65c0-.3.2-.4.5-.4Z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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