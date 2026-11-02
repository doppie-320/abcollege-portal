"use client";

import Image from "next/image";
import {
  Building2,
  GraduationCap,
  Landmark,
  MessageCircle,
  PartyPopper,
  VenetianMask,
  type LucideIcon,
} from "lucide-react";
import type { SuggestionAuthor, SuggestionCategory } from "@/lib/suggestions";

export const CATEGORY_ICONS: Record<SuggestionCategory, LucideIcon> = {
  ACADEMIC: GraduationCap,
  FACILITIES: Building2,
  EVENTS: PartyPopper,
  COUNCIL: Landmark,
  OTHER: MessageCircle,
};

/** Class that sets --sg-tone / --sg-tint for a category; defined in SuggestionsContent. */
export function toneClass(category: SuggestionCategory) {
  return `sgTone-${category.toLowerCase()}`;
}

export function CategoryIcon({ category, size = 14 }: { category: SuggestionCategory; size?: number }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}

/** The author's photo or initials, or a mask when the suggestion is anonymous. */
export function AuthorAvatar({ author, anonymous, size = 28 }: { author: SuggestionAuthor | null; anonymous: boolean; size?: number }) {
  if (anonymous || !author) {
    return (
      <span className="sgAvatar isMask" style={{ width: size, height: size }} aria-hidden="true">
        <VenetianMask size={Math.round(size * 0.58)} strokeWidth={2} />
      </span>
    );
  }

  if (author.avatarUrl) {
    return (
      <Image
        src={author.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="sgAvatar isPhoto"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span className="sgAvatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {author.initials || "?"}
    </span>
  );
}
