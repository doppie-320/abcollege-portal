export const instant = false;

import type { Metadata } from "next";
import HomeContent from "./HomeContent";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home — SOE Hub",
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data: authUser, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .eq('id', authUser.user.id)
    .single();

  if (userError) throw userError;

  console.log(userData);

  return <HomeContent current_user={userData as any}/>;
  
}

