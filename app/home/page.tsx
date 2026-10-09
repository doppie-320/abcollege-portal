export const instant = false;

import type { Metadata } from "next";
import HomeContent from "./HomeContent";

import { createClient } from "@/lib/supabase/server";
import { isApproved } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Home — SOE Hub",
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: authUser, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!(await isApproved(supabase, authUser.user.id))) redirect("/login?error=pending");

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, first_name, last_name, avatar_path")
    .eq('id', authUser.user.id)
    .single();

  if (userError) throw userError;

  // A row in "admins" (keyed by users.id) is what makes an account an admin.
  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userData.id)
    .maybeSingle();

  if (adminError) throw adminError;  

  const firstName = userData.first_name?.trim() ?? "";
  const lastName = userData.last_name?.trim() ?? "";

  const avatarUrl = userData.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(userData.avatar_path).data.publicUrl
    : "";

  return (
    <HomeContent
      current_user={{
        id: userData.id,
        name: `${firstName} ${lastName}`.trim(),
        initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
        avatar_path: avatarUrl,
      }}
      is_admin={adminRow !== null}
    />
  );
  
}

