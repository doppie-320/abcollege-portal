'use server'

import { ActionResult } from "@/lib/actionResult";
import { avatarFiles, newAvatarPaths } from "@/lib/avatarPaths";
import { createClient } from "@/lib/supabase/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

export async function logout() {
    const supabase = await createClient();

    // Only this device. The default ("global") ended every session the user had,
    // so logging out of a lab PC also logged them out on their phone, and admins
    // had to enter a new emailed code everywhere.
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
        throw new Error(`Error logging out: ${error.message}`);
    }

    redirect("/login");
}

// Keep in sync with MAX_FILE_BYTES / ACCEPTED_TYPES in lib/avatar.ts.
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

function checkAvatarUpload(file: FormDataEntryValue | null): string | null {
    if (!(file instanceof File) || file.size === 0) {
        return "No photo was received. Please pick one again.";
    }
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) return "Pick a JPG, PNG, or WebP image.";
    if (file.size > MAX_AVATAR_BYTES) return "That image is over 10 MB. Pick a smaller one.";
    return null;
}

/** Saves the cropped square ("pfp") along with the whole photo it was cut from ("pfp_full"). */
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) redirect("/login");
    const userId = authData.user.id;

    // Re-check on the server: the client-side checks can be bypassed.
    const crop = formData.get("pfp");
    const full = formData.get("pfp_full");
    const invalid = checkAvatarUpload(crop) ?? checkAvatarUpload(full);
    if (invalid) return { error: invalid };
    const cropFile = crop as File;
    const fullFile = full as File;

    // Read the current path first, so the old file is only removed once the new one is saved.
    const { data: profile, error: profileError } = await supabase
        .from("users").select("avatar_path").eq("id", userId).maybeSingle();
    if (profileError) {
        console.error("[avatar] reading current avatar failed:", profileError);
        return { error: "Couldn't update your profile picture. Please try again." };
    }

    const paths = newAvatarPaths(userId);
    const bucket = supabase.storage.from("avatars");
    const uploads = await Promise.all([
        bucket.upload(paths.crop, cropFile, { contentType: cropFile.type }),
        bucket.upload(paths.full, fullFile, { contentType: fullFile.type }),
    ]);
    const uploadError = uploads.find((upload) => upload.error)?.error;
    if (uploadError) {
        console.error("[avatar] upload failed:", uploadError);
        // Roll back whichever half made it, so the bucket doesn't collect orphaned uploads.
        await bucket.remove([paths.crop, paths.full]);
        return { error: "Couldn't upload your photo. Please try again." };
    }

    const { error: updateError } = await supabase
        .from("users").update({ avatar_path: paths.crop }).eq("id", userId);
    if (updateError) {
        console.error("[avatar] saving new avatar_path failed:", updateError);
        await bucket.remove([paths.crop, paths.full]);
        return { error: "Couldn't save your new profile picture. Please try again." };
    }

    // The new photo is live; a failed cleanup only leaves unused files behind.
    if (profile?.avatar_path) {
        const { error: removeError } = await bucket.remove(avatarFiles(profile.avatar_path));
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
    const { error: removeError } = await supabase.storage.from("avatars").remove(avatarFiles(profile.avatar_path));
    if (removeError) console.error("[avatar] removing avatar file failed:", removeError);

    refresh();
    return { success: true };
}