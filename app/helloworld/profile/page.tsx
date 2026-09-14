export const instant = false;

import { createClient } from "@/lib/supabase/server";

export default async function Page() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
        return (
            <main>
                <h1>We could not get your profile data :( Error: {authError.message}</h1>
            </main>
        );
    }

    if (!user) {
        return (
            <main>
                <h1>You are not logged in :(</h1>
            </main>
        );
    }

    const { data, error: userError } = await supabase
        .from("users")
        .select()
        .eq('id', user.id)
        .single();

    if (userError) {
        console.error("Error fetching user data:", userError);

        return (
            <main>
                <h1>We could not get your profile data :( Error: {userError.message}</h1>
            </main>
        );
    }

    return (
        <main>
            <h1>Hello! {data.first_name} {data.second_name}</h1>
        </main>
    );
}