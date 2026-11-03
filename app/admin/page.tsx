export const instant = false;

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminContent from "./AdminContent";
import { getProfile, isAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin — SOE Hub",
};

export default async function AdminPage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);

  if (!admin) redirect("/home");

  return <AdminContent profile={profile} />;
}
