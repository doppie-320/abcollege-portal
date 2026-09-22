export const instant = false;

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Page() {
    const supabase = await createClient();

    const { data: authUser , error: authError } = await supabase.auth.getUser();

    if(authError) {
        redirect("/helloworld/auth/login");        
    }

    if(!authUser) {
        redirect("/helloworld/auth/login");
    }

    const { data, error: userError } = await supabase
        .from("users")
        .select()
        .eq('id', authUser.user.id)
        .single();    

    if(userError) {
        return (
            <main>
                <h1>We could not get your profile data.</h1>
                <br></br>
                <h2>Error: {userError.message}</h2>
            </main>
        )
    }

    return(
        <main>
            <h1>Hello! {data.first_name} {data.last_name}!</h1>
        </main>
    );
}