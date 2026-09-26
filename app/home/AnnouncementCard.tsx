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
  onToggleReaction,
  onAddComment,
  onUpdatePost,
  onDeletePost,
}: {
  announcement: Announcement;
  currentUser: User;
  tags: string[];
  onToggleReaction: (postId: string) => void;
  onAddComment: (postId: string, body: string) => Promise<void>;
  onUpdatePost: (postId: string, post: NewPost) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
}) {
  const [showPostModal, setShowPostModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // TEMP: every post shows the edit/delete menu for now. Restore the author check
  // (announcement.authorId === currentUser.id) once roles/permissions are decided.
  const canManage = true;

  return (
    <div className="announceItem">
      <PostContent
        announcement={announcement}
        currentUser={currentUser}
        onToggleReaction={onToggleReaction}
        onCommentClick={() => setShowPostModal(true)}
        collapsible
        onEdit={canManage ? () => setShowEditModal(true) : undefined}
        onDelete={canManage ? () => setShowDeleteDialog(true) : undefined}
      />

      {showPostModal && (
        <PostModal
          announcement={announcement}
          currentUser={currentUser}
          onToggleReaction={onToggleReaction}
          onAddComment={onAddComment}
          onClose={() => setShowPostModal(false)}
        />
      )}

      {showEditModal && (
        <CreatePostModal
          currentUser={currentUser}
          tags={tags}
          initialPost={{
            title: announcement.title,
            tag: announcement.tag,
            content: announcement.body,
            postedAt: announcement.postedAt,
          }}
          onClose={() => setShowEditModal(false)}
          onSubmit={(post) => onUpdatePost(announcement.id, post)}
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
          busyLabel="Deleting..."
          errorMessage="Couldn't delete this post. Please try again."
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={() => onDeletePost(announcement.id)}
        />
      )}

      <style jsx>{`
        .announceItem {
          padding: 24px 0;
          animation: fadeInUp 0.4s ease backwards;
          animation-delay: 0.25s;
        }

        .announceItem:first-of-type {
          padding-top: 0;
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

        .announceItem + .announceItem {
          border-top: 1px solid #c9bfa0;
        }
      `}</style>
    </div>
  );
}
