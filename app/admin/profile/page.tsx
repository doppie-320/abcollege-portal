export const instant = false;

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminProfileContent from "./AdminProfileContent";
import { getProfile, isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "My Profile — Admin",
};

export default async function AdminProfilePage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);

  if (!admin) redirect("/home");

  return <AdminProfileContent profile={profile} />;
}