"use client";

import { useState } from "react";
import PostContent from "./PostContent";
import PostModal from "./PostModal";
import type { Announcement, Person } from "@/lib/mock/social-db";

export default function AnnouncementCard({
  announcement,
  currentUser,
  onToggleReaction,
  onAddComment,
}: {
  announcement: Announcement;
  currentUser: Person;
  onToggleReaction: (postId: string) => void;
  onAddComment: (postId: string, body: string) => void;
}) {
  const [showPostModal, setShowPostModal] = useState(false);

  return (
    <div className="announceItem">
      <PostContent
        announcement={announcement}
        currentUser={currentUser}
        onToggleReaction={onToggleReaction}
        onCommentClick={() => setShowPostModal(true)}
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
