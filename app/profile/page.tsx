export const instant = false;

import type { Metadata } from "next";
import ProfileContent from "./ProfileContent";
import { getProfile, isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Profile Page",
};

export default async function ProfilePage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);

  return <ProfileContent profile={profile} isAdmin={admin} />;
}
