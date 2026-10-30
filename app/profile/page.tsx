export const instant = false;

import type { Metadata } from "next";
import ProfileContent from "./ProfileContent";
import { getProfile, isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Profile Page",
};

export default async function ProfilePage() {
  const profile = await getProfile();
  const admin = await isAdmin();

  return <ProfileContent profile={profile} isAdmin={admin} />;
}
