export const instant = false;

import type { Metadata } from "next";
import SuggestionsContent from "./SuggestionsContent";
import { getProfile, isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Suggestion Box — SOE Hub",
};

export default async function SuggestionsPage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);

  // Suggestions themselves come from the mock store for now (lib/mock/suggestions-db.ts).
  return <SuggestionsContent profile={profile} isAdmin={admin} />;
}
