export const instant = false;

import type { Metadata } from "next";
import SuggestionsContent from "./SuggestionsContent";
import PageTransition from "@/components/PageTransition";
import { getViewer } from "@/lib/auth";
import { listMySuggestions, listSuggestionInbox } from "@/lib/mock/portal-db";

export const metadata: Metadata = {
  title: "Suggestion Box — SOE Hub",
};

export default async function SuggestionsPage() {
  const viewer = await getViewer();

  const [suggestions, inbox] = await Promise.all([
    listMySuggestions(viewer.id),
    // Only admins get the council inbox.
    viewer.isAdmin ? listSuggestionInbox() : Promise.resolve(null),
  ]);

  return (
    <PageTransition>
      <SuggestionsContent viewer={viewer} suggestions={suggestions} inbox={inbox} />
    </PageTransition>
  );
}
