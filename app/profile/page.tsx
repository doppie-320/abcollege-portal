export const instant = false;

import type { Metadata } from "next";
import ProfileContent from "./ProfileContent";
import { getProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Profile Page",
};

export default async function ProfilePage() {
  const profile = await getProfile();

  return <ProfileContent profile={profile} />;
}
