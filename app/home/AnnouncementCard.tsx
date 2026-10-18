"use client";

import { useState } from "react";
import PostContent from "./PostContent";
import PostModal from "./PostModal";
import CreatePostModal, { type NewPost } from "./CreatePostModal";
import ConfirmDialog from "./ConfirmDialog";
import type { Announcement, User } from "@/app/home/HomeContent";

export default function AnnouncementCard({
  announcement,
  currentUser,
  tags,
  canManage,
  onToggleReaction,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onUpdatePost,
  onDeletePost,
}: {
  announcement: Announcement;
  currentUser: User;
  tags: string[];
  // Admins get the "..." menu with Edit post / Delete post.
  canManage: boolean;
  onToggleReaction: (postId: string) => void;
  onAddComment: (postId: string, body: string) => Promise<void>;
  // Applied at once; rejects (after rolling back) so the edit box can reopen.
  onUpdateComment: (postId: string, commentId: string, body: string) => Promise<void>;
  // Applied at once; restores the comment and shows a toast itself on failure.
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  // Applied at once; rejects (after rolling back) so the editor can reopen with the draft.
  onUpdatePost: (postId: string, post: NewPost) => Promise<void>;
  // Applied at once; restores the post and shows a toast itself on failure.
  onDeletePost: (postId: string) => Promise<void>;
}) {
  const [showPostModal, setShowPostModal] = useState(false);
  // `draft` is set when a save failed and the editor reopens with the user's changes.
  const [editing, setEditing] = useState<{ draft?: NewPost; error?: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  function saveEdit(post: NewPost) {
    onUpdatePost(announcement.id, post).catch(() =>
      setEditing({ draft: post, error: "Couldn't save your changes. Please try again." }),
    );
  }

  return (
    <div className={`announceItem${announcement.pending ? " isPending" : ""}`} aria-busy={announcement.pending || undefined}>
      {announcement.pending && <span className="pendingTag mono">PUBLISHING…</span>}
      <PostContent
        announcement={announcement}
        currentUser={currentUser}
        onToggleReaction={onToggleReaction}
        onCommentClick={() => setShowPostModal(true)}
        collapsible
        onEdit={canManage ? () => setEditing({}) : undefined}
        onDelete={canManage ? () => setShowDeleteDialog(true) : undefined}
      />

      {showPostModal && (
        <PostModal
          announcement={announcement}
          currentUser={currentUser}
          onToggleReaction={onToggleReaction}
          onAddComment={onAddComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          canModerate={canManage}
          onClose={() => setShowPostModal(false)}
        />
      )}

      {editing && (
        <CreatePostModal
          currentUser={currentUser}
          tags={tags}
          initialPost={{
            title: announcement.title,
            tag: announcement.tag,
            content: announcement.body,
            postedAt: announcement.postedAt,
          }}
          draft={editing.draft}
          initialError={editing.error}
          onClose={() => setEditing(null)}
          onSubmit={saveEdit}
        />
      )}

      {showDeleteDialog && (
        <ConfirmDialog
          eyebrow="DELETE · BULLETIN POST"
          title="Delete this post?"
          message={
            <>
              <strong>&ldquo;{announcement.title}&rdquo;</strong> will be removed from the bulletin board along with its
              reactions and comments. This can&apos;t be undone.
            </>
          }
          confirmLabel="Delete"
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={() => {
            setShowDeleteDialog(false);
            void onDeletePost(announcement.id);
          }}
        />
      )}

      <style jsx>{`
        /* The segment's border, background and corner rounding come from .feed in HomeContent. */
        .announceItem {
          padding: 22px 24px 16px;
          animation: fadeInUp 0.4s ease backwards;
          animation-delay: 0.25s;
          transition: box-shadow 0.2s ease;
        }

        .announceItem:hover {
          box-shadow: inset 3px 0 0 var(--orange);
        }

        /* Shown at once while it's still being saved; nothing on it works until then. */
        .announceItem.isPending {
          opacity: 0.6;
          pointer-events: none;
        }

        .pendingTag {
          display: inline-block;
          margin-bottom: 8px;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          color: var(--orange);
        }

        .announceItem:nth-of-type(1) {
          animation-delay: 0.05s;
        }

        .announceItem:nth-of-type(2) {
          animation-delay: 0.1s;
        }

        .announceItem:nth-of-type(3) {
          animation-delay: 0.15s;
        }

        .announceItem:nth-of-type(4) {
          animation-delay: 0.2s;
        }
      `}</style>
    </div>
  );
}
