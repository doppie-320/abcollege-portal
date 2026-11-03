export const instant = false;

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UserAccountReview from "./UserAccountReview";
import { getProfile, isAdmin } from "@/lib/auth";
import { fetchApplicants } from "@/lib/applicants-server";

export const metadata: Metadata = {
  title: "User Account Review — Admin",
};

export default async function UserAccountReviewPage() {
  // Read-only, so the list loads alongside the admin check; non-admins are
  // redirected before any of it is used.
  const [profile, admin, applicants] = await Promise.all([getProfile(), isAdmin(), fetchApplicants()]);

  if (!admin) redirect("/home");

  return <UserAccountReview profile={profile} applicants={applicants} />;
}
