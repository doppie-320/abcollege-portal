import type { Metadata } from "next";
import HomeContent from "./HomeContent";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home — SOE Hub",
};

export default async function HomePage() {
  const supabase = await createClient();
    
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select()
      .eq('id', authUser.user!.id)
      .single();
  

  return <HomeContent last_name={userData.last_name} first_name={userData.first_name}/>;
}
