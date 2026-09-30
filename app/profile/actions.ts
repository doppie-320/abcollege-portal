'use server'

import { createClient } from "@/lib/supabase/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

export async function logout() {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error(`Error logging out: ${error.message}`);
    }

    redirect("/login");
}

export async function uploadAvatar(formData: FormData) {
    const supabase = await createClient();

    const { data: authData, error: authError } =
        await supabase.auth.getUser();
    if(authError) {
        throw new Error(`Error getting user: ${authError.message}`);
    }
    if(!authData.user)  redirect("/login");
    const userId = authData.user.id;

    const file = formData.get("pfp");
    if (file instanceof File) {
        if((file.size / (1024 * 1024)) > 10) {
            throw new Error(`Profile picture must be less than 10MB!`);
        }

        const { data: uploadData, error: uploadError } =
            await supabase.storage.from("avatars").upload(`${userId}/${crypto.randomUUID()}.jpg`, file);
        if (uploadError) {
            throw new Error(`Error uploading your profile picture: ${uploadError.message}`);
        }

        const { data: oldPfpData, error: oldPfpError } =
            await supabase.from("users").select("avatar_path").eq("id", userId).single();

        const { error: updateError } =
            await supabase.from("users").update({ avatar_path: uploadData?.path }).eq('id', userId);

            if(!oldPfpError) await supabase.storage.from('avatars').remove([oldPfpData?.avatar_path]);
        if (updateError) {
            await supabase.storage.from("avatars").remove([uploadData.path]);
            throw new Error(`Error row update for new avatar_path: ${updateError.message}`)
        } else {
            refresh();
        }
    } else {
        throw new Error(`Error getting profile picture data!`);
    }
}

export async function deleteAvatar() {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if(!authData.user) redirect("/login");
    const userId = authData.user.id;

    const { data: selectData, error: selectError } = await supabase
        .from("users").select("avatar_path").eq("id", userId).maybeSingle();
    if(selectError) throw new Error(`Error reading your profile: ${selectError.message}`);
    if(!selectData?.avatar_path) return;

    const { error: updateError } = await supabase
        .from("users").update({ avatar_path: null }).eq("id", userId);
    if(updateError) throw new Error(`Error removing your profile picture: ${updateError.message}`);

    await supabase.storage.from("avatars").remove([selectData.avatar_path]);

    refresh();
}