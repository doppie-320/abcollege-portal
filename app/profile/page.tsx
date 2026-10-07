export const instant = false;

import type { Metadata } from "next";
import ProfileContent from "./ProfileContent";
import PageTransition from "@/components/PageTransition";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Profile Page",
};

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <PageTransition>
      <ProfileContent profile={profile} />
    </PageTransition>
  );
}
