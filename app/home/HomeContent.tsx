"use client";

import Link from "next/link";
import AnnouncementCard from "./AnnouncementCard";
import BirthdaysCard from "./BirthdaysCard";
import CountdownCard from "./CountdownCard";
import CreatePostModal, { type NewPost } from "./CreatePostModal";
import Select from "@/components/Select";
import SiteNav, { ADMIN_MENU_LINKS, HOME_ADMIN_NAV_LINKS, PAGE_RESELECT_EVENT } from "@/components/NavigationHeader";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client"
import { useRouter } from "next/navigation";
import { richTextToPlain } from "@/lib/richText";
import { toast } from "@/components/Toaster";
import type { CalendarEvent, UpcomingBirthday } from "@/lib/calendar";

export type User = {
  id: string;
  name: string;
  initials: string;
  isAdmin?: AdminRole;
  avatar_path: string;
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
  /** Shown optimistically while it's still being saved. */
  pending?: boolean;
};

export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  // Public URL of the commenter's profile picture, or "" to fall back to initials.
  authorAvatar: string;
  body: string;
  postedAt: string;
};

type CommentRow = {
  id: string;
  announcement_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
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

function toComment(row: CommentRow, author?: UserRow, authorAvatar = ""): Comment {
  const firstName = author?.first_name?.trim() ?? "";
  const lastName = author?.last_name?.trim() ?? "";
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: `${firstName} ${lastName}`.trim() || "Unknown",
    authorInitials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?",
    authorAvatar,
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
  is_admin: boolean;
  /** "YYYY-MM-DD" in school time, decided on the server. */
  today: string;
  birthdays: UpcomingBirthday[];
  upcomingEvents: CalendarEvent[];
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
    .select("id, first_name, last_name, avatar_path")
    .eq("id", user_id)
    .single();

  if (userError) throw userError;

  const firstName = userData.first_name?.trim() ?? "";
  const lastName = userData.last_name?.trim() ?? "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return {
    id: userData.id,
    name: [firstName, lastName].filter(Boolean).join(" "),
    initials,
    avatar_path: userData.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(userData.avatar_path).data.publicUrl
      : "",
  };
}

export default function HomeContent({ current_user, is_admin, today, birthdays, upcomingEvents }: HomeContentProps) {
  const [dateLine, setDateLine] = useState("");
  var [announcements, setAnnouncements] = useState<Announcement[]>(ANNOUNCEMENTS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const pendingReactionIds = useRef(new Set<string>());
  const supabase = createClient();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>(Tags);
  const [activeTag, setActiveTag] = useState<TagKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Open composer; `draft` is set when publishing failed and it reopens with the post.
  const [composer, setComposer] = useState<{ draft?: NewPost; error?: string } | null>(null);
  // When a countdown runs out, the server sends the next events (and today's birthdays).
  const refreshSidebar = useCallback(() => router.refresh(), [router]);


  useEffect(() => {
    setDateLine(formatDateLine(new Date()));
    const loadAnnouncements = async () => {
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
          .select("id, announcement_id, author_id, content, created_at")
          .order("created_at", { ascending: true });

        if (commentsError) console.error("Error fetching announcement comments:", commentsError);

        const commentRows: CommentRow[] = commentData || [];
        const commenterIds = [...new Set(commentRows.map((comment) => comment.author_id))];
        const { data: commenterData } = commenterIds.length
          ? await supabase.from("users").select("id, first_name, last_name, avatar_path").in("id", commenterIds)
          : { data: [] as UserRow[] };
        const commenters = new Map((commenterData || []).map((user: UserRow) => [user.id, user]));
        const commenterAvatar = (userId: string) => {
          const path = commenters.get(userId)?.avatar_path;
          return path ? supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl : "";
        };

        const loadedAnnouncements: Announcement[] = (announcementData || []).map((row) => ({
          ...toAnnouncement(row),
          reactedBy: (announcementReacts || [])
            .filter((reaction) => reaction.announcement_id === row.id)
            .map((reaction) => reaction.user_id),
          comments: commentRows
            .filter((comment) => comment.announcement_id === row.id)
            .map((comment) =>
              toComment(comment, commenters.get(comment.author_id), commenterAvatar(comment.author_id))
            ),
        }));

        console.log(loadedAnnouncements);

        // One filter option per tag, even when several posts share it.
        const loadedTags = [...new Set((announcementData || []).map((row) => row.tag))].map((tag) => ({
          key: tag,
          label: tag
        }));

        setTags(loadedTags)
        setAnnouncements(loadedAnnouncements);



      } catch (err) {
        console.error(err);
      };
    };

    loadAnnouncements();

    // Clicking the SOE HUB logo or Home while already on /home reloads the feed.
    window.addEventListener(PAGE_RESELECT_EVENT, loadAnnouncements);
    return () => window.removeEventListener(PAGE_RESELECT_EVENT, loadAnnouncements);
  }, []);

  const visibleAnnouncements = announcements.filter((a) => {
    const matchesTag = activeTag === "all" || a.tag === activeTag;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      q === "" || a.title.toLowerCase().includes(q) || richTextToPlain(a.body).toLowerCase().includes(q);
    return matchesTag && matchesQuery;
  });

  // Every change below shows at once and is rolled back if Supabase refuses it.

  function patchAnnouncement(postId: string, patch: Partial<Announcement>) {
    setAnnouncements((current) => current.map((item) => (item.id === postId ? { ...item, ...patch } : item)));
  }

  /** Puts a removed item back where it was, or as close as the list now allows. */
  function reinsert<T>(list: T[], index: number, item: T): T[] {
    const next = [...list];
    next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
    return next;
  }

  // Rejects after removing the placeholder, so the composer can reopen with the draft.
  async function handleCreatePost(post: NewPost) {
    if (!currentUser) return;

    const tempId = `temp-${Date.now()}`;
    setAnnouncements((current) => [
      {
        id: tempId,
        tag: post.tag,
        title: post.title,
        body: post.content,
        postedAt: new Date().toISOString(),
        authorId: currentUser.id,
        reactedBy: [],
        comments: [],
        pending: true,
      },
      ...current,
    ]);
    addTagOption(post.tag);

    const { data, error } = await supabase
      .from("announcements")
      .insert({ tag: post.tag, title: post.title, content: post.content, author_id: currentUser.id })
      .select("id, tag, title, content, created_at, media, author_id")
      .single();

    if (error) {
      console.error("Error creating announcement:", error);
      setAnnouncements((current) => current.filter((item) => item.id !== tempId));
      throw error;
    }

    setAnnouncements((current) => current.map((item) => (item.id === tempId ? toAnnouncement(data) : item)));
  }

  function publishPost(post: NewPost) {
    handleCreatePost(post).catch(() =>
      setComposer({ draft: post, error: "Couldn't publish your post. Please try again." })
    );
  }

  // Rejects after restoring the old version, so the editor can reopen with the draft.
  async function handleUpdatePost(postId: string, post: NewPost) {
    const previous = announcements.find((item) => item.id === postId);
    patchAnnouncement(postId, { tag: post.tag, title: post.title, body: post.content });
    addTagOption(post.tag);

    const { data, error } = await supabase
      .from("announcements")
      .update({ tag: post.tag, title: post.title, content: post.content })
      .eq("id", postId)
      .select("id, tag, title, content, created_at, media, author_id")
      .single();

    if (error) {
      console.error("Error updating announcement:", error);
      if (previous) patchAnnouncement(postId, { tag: previous.tag, title: previous.title, body: previous.body });
      throw error;
    }

    const updated = toAnnouncement(data);
    patchAnnouncement(postId, { tag: updated.tag, title: updated.title, body: updated.body, media: updated.media });
  }

  async function handleDeletePost(postId: string) {
    const index = announcements.findIndex((item) => item.id === postId);
    const removed = announcements[index];
    if (!removed) return;
    setAnnouncements((current) => current.filter((item) => item.id !== postId));

    // Select the deleted row back: a delete blocked by RLS returns no error, just no rows.
    const { data, error } = await supabase.from("announcements").delete().eq("id", postId).select("id");

    if (error || !data?.length) {
      console.error("Error deleting announcement:", error ?? "no rows deleted");
      setAnnouncements((current) => reinsert(current, index, removed));
      toast(`Couldn't delete "${removed.title}". It's back on the board.`);
    }
  }

  function addTagOption(tag: string) {
    setTags((current) => (current.some((t) => t.key === tag) ? current : [...current, { key: tag as TagKey, label: tag }]));
  }

  async function handleToggleReaction(postId: string) {
    // A post that's still publishing has no row to react to yet.
    if (!currentUser || postId.startsWith("temp-") || pendingReactionIds.current.has(postId)) return;

    const announcement = announcements.find((item) => item.id === postId);
    if (!announcement) return;

    pendingReactionIds.current.add(postId);
    const userId = currentUser.id;
    const hasReacted = announcement.reactedBy.includes(userId);
    const setReacted = (reacted: boolean) =>
      setAnnouncements((current) =>
        current.map((item) => {
          if (item.id !== postId) return item;
          const others = item.reactedBy.filter((id) => id !== userId);
          return { ...item, reactedBy: reacted ? [...others, userId] : others };
        })
      );

    setReacted(!hasReacted);

    try {
      const result = hasReacted
        ? await supabase
          .from("announcement_reactions")
          .delete()
          .eq("announcement_id", postId)
          .eq("user_id", userId)
        : await supabase
          .from("announcement_reactions")
          .insert({ announcement_id: postId, user_id: userId });

      if (result.error) throw result.error;
    } catch (error) {
      console.error("Error toggling announcement reaction:", error);
      setReacted(hasReacted);
      toast("Couldn't update your reaction. Please try again.");
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
      authorAvatar: currentUser.avatar_path,
      body,
      postedAt: new Date().toISOString(),
    };

    // Show the comment immediately, then swap in the saved row (or roll back on failure).
    updateCommentsOf(postId, (comments) => [...comments, pending]);

    const { data, error } = await supabase
      .from("announcement_comments")
      .insert({ announcement_id: postId, author_id: currentUser.id, content: body })
      .select("id, announcement_id, author_id, content, created_at")
      .single();

    if (error) {
      console.error("Error adding announcement comment:", error);
      updateCommentsOf(postId, (comments) => comments.filter((comment) => comment.id !== tempId));
      throw error;
    }

    updateCommentsOf(postId, (comments) =>
      comments.map((comment) => (comment.id === tempId ? { ...pending, id: data.id, postedAt: data.created_at } : comment))
    );
  }

  function updateCommentsOf(postId: string, update: (comments: Comment[]) => Comment[]) {
    setAnnouncements((current) =>
      current.map((item) => (item.id === postId ? { ...item, comments: update(item.comments) } : item))
    );
  }

  function findComment(postId: string, commentId: string) {
    const comments = announcements.find((item) => item.id === postId)?.comments ?? [];
    const index = comments.findIndex((comment) => comment.id === commentId);
    return { index, comment: comments[index] as Comment | undefined };
  }

  // Rejects after restoring the old text, so the edit box can reopen.
  async function handleUpdateComment(postId: string, commentId: string, body: string) {
    const { comment: previous } = findComment(postId, commentId);
    const setBody = (text: string) =>
      updateCommentsOf(postId, (comments) =>
        comments.map((comment) => (comment.id === commentId ? { ...comment, body: text } : comment))
      );
    setBody(body);

    // Select the row back: an update blocked by RLS returns no error, just no rows.
    const { data, error } = await supabase
      .from("announcement_comments")
      .update({ content: body })
      .eq("id", commentId)
      .select("id, content")
      .maybeSingle();

    if (error || !data) {
      console.error("Error updating announcement comment:", error ?? "no rows updated");
      if (previous) setBody(previous.body);
      throw error ?? new Error("Comment was not updated.");
    }

    setBody(data.content);
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    const { index, comment: removed } = findComment(postId, commentId);
    if (!removed) return;
    updateCommentsOf(postId, (comments) => comments.filter((comment) => comment.id !== commentId));

    // Same as posts: select the deleted row back so an RLS-blocked delete counts as a failure.
    const { data, error } = await supabase.from("announcement_comments").delete().eq("id", commentId).select("id");

    if (error || !data?.length) {
      console.error("Error deleting announcement comment:", error ?? "no rows deleted");
      updateCommentsOf(postId, (comments) => reinsert(comments, index, removed));
      toast("Couldn't delete the comment. It's been put back.");
    }
  }


  return (
    <>
      <SiteNav
        initials={current_user.initials}
        name={current_user.name}
        userId={current_user.id}
        avatarUrl={current_user.avatar_path}
        links={is_admin ? HOME_ADMIN_NAV_LINKS : undefined}
        menuLinks={is_admin ? ADMIN_MENU_LINKS : undefined}
      />

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
            <span className="date mono">
              <span className="liveDot" aria-hidden="true" />
              {dateLine}
            </span>
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
                  {is_admin && <button
                    type="button"
                    className="btn createPostBtn"
                    onClick={() => setComposer({})}
                    aria-label="Create post"
                  >
                    <PlusIcon />
                    <span className="createPostLabel">Create post</span>
                  </button>
                  }
                </div>
              </div>
            </div>

            {/* Each post is its own segment; only the outer corners of the stack are rounded. */}
            <div className="feed tick-frame">
              <header className="feedHead">
                <span className="feedHeadIcon">
                  <MegaphoneIcon />
                </span>
                <span className="mono feedHeadLabel">Announcements</span>
                <span className="mono feedHeadMeta">
                  {visibleAnnouncements.length === announcements.length
                    ? `${announcements.length} posted`
                    : `${visibleAnnouncements.length} of ${announcements.length}`}
                </span>
              </header>

              {!currentUser ? null : visibleAnnouncements.length === 0 ? (
                <p className="emptyState">
                  <span className="emptyIcon">
                    <SearchIcon />
                  </span>
                  {announcements.length === 0 ? "Nothing has been posted yet." : "No announcements match your search."}
                </p>
              ) : (
                visibleAnnouncements.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    announcement={item}
                    currentUser={currentUser}
                    tags={POST_TAGS}
                    canManage={is_admin}
                    onToggleReaction={handleToggleReaction}
                    onAddComment={handleAddComment}
                    onUpdateComment={handleUpdateComment}
                    onDeleteComment={handleDeleteComment}
                    onUpdatePost={handleUpdatePost}
                    onDeletePost={handleDeletePost}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="sideColumn">
            <BirthdaysCard birthdays={birthdays} today={today} currentUserId={current_user.id} />
            <CountdownCard events={upcomingEvents} today={today} onExpire={refreshSidebar} />
          </aside>
        </div>
      </div>

      {composer && currentUser && (
        <CreatePostModal
          currentUser={currentUser}
          tags={POST_TAGS}
          draft={composer.draft}
          initialError={composer.error}
          onClose={() => setComposer(null)}
          onSubmit={publishPost}
        />
      )}

      <style jsx global>{`
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
          font-size: var(--fs-display);
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

        .createPostBtn:not(:disabled):hover {
          background: var(--navy-deep);
          transform: translate(-2px, -2px);
          box-shadow: 3px 3px 0 var(--orange), 6px 6px 0 var(--yellow);
        }

        .createPostBtn:not(:disabled):active {
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

        /* Small phones (519px and below): search, filter, and post share one
           row inside the container — the post button keeps only its icon. */
        @media (max-width: 519px) {
          .toolbar {
            padding: 10px 12px;
          }

          .toolbarInner {
            flex-wrap: nowrap;
            gap: 8px;
          }

          .searchWrap {
            flex: 1 1 auto;
            flex-basis: auto;
            min-width: 0;
            max-width: none;
          }

          .toolbarActions {
            width: auto;
            flex-shrink: 0;
            gap: 8px;
          }

          .tagFilterWrap {
            width: 104px;
          }

          .createPostBtn {
            padding: 8px;
          }

          .createPostBtn .createPostLabel {
            display: none;
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

        .sectionNum {
          color: var(--orange);
          margin-right: 6px;
        }

        /* ---------- Segmented announcement feed ---------- */
        .feed.tick-frame {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 0;
          border: none;
          background: none;
        }

        /* Top corner ticks frame the head of the stack; no ticks at the bottom. */
        .feed.tick-frame::before,
        .feed.tick-frame::after {
          z-index: 2;
        }

        .feed.tick-frame::before {
          top: 0;
          left: 0;
          border-radius: 8px 0 0 0;
        }

        .feed.tick-frame::after {
          top: 0;
          right: 0;
          border-radius: 0 8px 0 0;
        }

        /* :where keeps this at one class of specificity so segment-specific rules win. */
        .feed > :where(:not(.tick-bl, .tick-br)) {
          background: var(--white);
          border: 1px solid #c9bfa0;
          border-radius: 0;
        }

        .feed > .feedHead {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
        }

        .feed > :last-child {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }

        .feed > .feedHead {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 20px;
          border-bottom: 2px solid var(--navy);
          color: var(--navy);
          animation: fadeInUp 0.4s ease backwards;
        }

        .feedHeadIcon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #fcebdf;
          color: var(--orange);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .feedHeadLabel {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          flex: 1;
        }

        .feedHeadMeta {
          font-size: 10.5px;
          color: var(--ink-soft);
          padding: 2px 8px;
          background: var(--vellum);
          border: 1px solid var(--rule-soft);
          border-radius: 999px;
        }

        .feed > .emptyState {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--ink-soft);
          padding: 22px 24px;
          margin-bottom: 0;
        }

        .emptyIcon {
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

        /* ---------- Hero accents ---------- */
        .date {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .liveDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--orange);
          box-shadow: 0 0 0 0 rgba(217, 83, 30, 0.5);
          animation: livePulse 2s ease-out infinite;
        }

        @keyframes livePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(217, 83, 30, 0.5);
          }
          70%,
          100% {
            box-shadow: 0 0 0 7px rgba(217, 83, 30, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .liveDot {
            animation: none;
          }
        }

        /* Follows the reader down the feed; --nav-offset (set by SiteNav) keeps it clear of the nav bar. */
        .sideColumn {
          position: sticky;
          top: calc(var(--nav-offset, 0px) + 20px);
          transition: top 0.25s ease;
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

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          /* Tablet and below: birthdays + countdown are laptop-only. */
          .sideColumn {
            display: none;
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

function MegaphoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
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