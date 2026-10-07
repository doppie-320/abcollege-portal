export const instant = false;

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UserAccountReview from "./UserAccountReview";
import { getProfile, isAdmin } from "@/lib/auth";
import { fetchApplicants } from "@/lib/mock/applicants-db";

export const metadata: Metadata = {
  title: "User Account Review — Admin",
};

export default async function UserAccountReviewPage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);

  if (!admin) redirect("/home");

  const applicants = await fetchApplicants();

  return <UserAccountReview profile={profile} applicants={applicants} />;
}
