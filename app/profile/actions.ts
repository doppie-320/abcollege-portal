'use server'

import { ActionResult } from "@/lib/actionResult";
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

// Keep in sync with MAX_FILE_BYTES / ACCEPTED_TYPES in lib/avatar.ts.
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) redirect("/login");
    const userId = authData.user.id;

    // Re-check on the server: the client-side checks can be bypassed.
    const file = formData.get("pfp");
    if (!(file instanceof File) || file.size === 0) {
        return { error: "No photo was received. Please pick one again." };
    }
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
        return { error: "Pick a JPG, PNG, or WebP image." };
    }
    if (file.size > MAX_AVATAR_BYTES) {
        return { error: "That image is over 10 MB. Pick a smaller one." };
    }

    // Read the current path first, so the old file is only removed once the new one is saved.
    const { data: profile, error: profileError } = await supabase
        .from("users").select("avatar_path").eq("id", userId).maybeSingle();
    if (profileError) {
        console.error("[avatar] reading current avatar failed:", profileError);
        return { error: "Couldn't update your profile picture. Please try again." };
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`${userId}/${crypto.randomUUID()}.jpg`, file, { contentType: file.type });
    if (uploadError) {
        console.error("[avatar] upload failed:", uploadError);
        return { error: "Couldn't upload your photo. Please try again." };
    }

    const { error: updateError } = await supabase
        .from("users").update({ avatar_path: uploadData.path }).eq("id", userId);
    if (updateError) {
        console.error("[avatar] saving new avatar_path failed:", updateError);
        // Roll back so the bucket doesn't collect orphaned uploads.
        await supabase.storage.from("avatars").remove([uploadData.path]);
        return { error: "Couldn't save your new profile picture. Please try again." };
    }

    // The new photo is live; a failed cleanup only leaves an unused file behind.
    if (profile?.avatar_path) {
        const { error: removeError } = await supabase.storage.from("avatars").remove([profile.avatar_path]);
        if (removeError) console.error("[avatar] removing old avatar failed:", removeError);
    }

    refresh();
    return { success: true };
}

export async function deleteAvatar(): Promise<ActionResult> {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) redirect("/login");
    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
        .from("users").select("avatar_path").eq("id", userId).maybeSingle();
    if (profileError) {
        console.error("[avatar] reading current avatar failed:", profileError);
        return { error: "Couldn't remove your profile picture. Please try again." };
    }
    if (!profile?.avatar_path) return { success: true };

    const { error: updateError } = await supabase
        .from("users").update({ avatar_path: null }).eq("id", userId);
    if (updateError) {
        console.error("[avatar] clearing avatar_path failed:", updateError);
        return { error: "Couldn't remove your profile picture. Please try again." };
    }

    // The profile no longer points at the file; a failed cleanup only leaves an unused file behind.
    const { error: removeError } = await supabase.storage.from("avatars").remove([profile.avatar_path]);
    if (removeError) console.error("[avatar] removing avatar file failed:", removeError);

    refresh();
    return { success: true };
}