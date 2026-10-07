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
  onUpdateComment: (postId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  onUpdatePost: (postId: string, post: NewPost) => Promise<void>;
  onDeletePost: (postId: string) => void;
}) {
  const [showPostModal, setShowPostModal] = useState(false);
  // Open editor; `draft`/`error` are set when it reopens after a failed save.
  const [editor, setEditor] = useState<{ draft?: NewPost; error?: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // A new post shown before the database has it: no reacting, commenting or managing yet.
  const isPending = announcement.id.startsWith("temp-");
  const canManagePost = canManage && !isPending;

  function savePost(post: NewPost) {
    onUpdatePost(announcement.id, post).catch(() =>
      setEditor({ draft: post, error: "Couldn't save your changes. Please try again." })
    );
  }

  return (
    <div className={`announceItem${isPending ? " pending" : ""}`} aria-busy={isPending || undefined}>
      <PostContent
        announcement={announcement}
        currentUser={currentUser}
        onToggleReaction={isPending ? () => {} : onToggleReaction}
        onCommentClick={isPending ? () => {} : () => setShowPostModal(true)}
        collapsible
        onEdit={canManagePost ? () => setEditor({}) : undefined}
        onDelete={canManagePost ? () => setShowDeleteDialog(true) : undefined}
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

      {editor && (
        <CreatePostModal
          currentUser={currentUser}
          tags={tags}
          initialPost={{
            title: announcement.title,
            tag: announcement.tag,
            content: announcement.body,
            postedAt: announcement.postedAt,
          }}
          draft={editor.draft}
          initialError={editor.error}
          onClose={() => setEditor(null)}
          onSubmit={savePost}
        />
      )}

      {showDeleteDialog && (
        <ConfirmDialog
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
            onDeletePost(announcement.id);
          }}
        />
      )}

      <style jsx>{`
        /* Panel border, padding and corners come from .feedPanels in HomeContent. */
        .announceItem {
          animation: fadeInUp 0.4s ease backwards;
          animation-delay: 0.25s;
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

        .announceItem.pending {
          opacity: 0.6;
          transition: opacity 0.2s ease;
        }
      `}</style>
    </div>
  );
}
