export const instant = false;

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UserAccountReview from "./UserAccountReview";
import { getProfile, isAdmin } from "@/lib/auth";
import { parseApplicantQuery } from "@/lib/applicants-db";
import { fetchApplicantPage } from "@/lib/applicants-server";

export const metadata: Metadata = {
  title: "User Account Review — Admin",
};

export default async function UserAccountReviewPage({ searchParams }: PageProps<"/admin/user-account-review">) {
  const query = parseApplicantQuery(await searchParams);

  // Read-only, so the page loads alongside the admin check; the database only
  // answers admins, and non-admins are redirected before any of it is used.
  const [profile, admin, applicantPage] = await Promise.all([
    getProfile(),
    isAdmin(),
    fetchApplicantPage(query),
  ]);

  if (!admin) redirect("/home");

  return <UserAccountReview profile={profile} query={query} {...applicantPage} />;
}
