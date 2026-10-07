'use server'

import { ActionResult } from "@/lib/actionResult";
import { getViewer } from "@/lib/auth";
import {
    createSuggestion,
    deleteSuggestion as removeSuggestion,
    setSuggestionStatus as changeStatus,
    updateSuggestion as editSuggestion,
} from "@/lib/mock/portal-db";
import { refresh } from "next/cache";

// Keep in sync with MAX_LENGTH in SuggestionsContent.tsx.
const MAX_LENGTH = 2000;
const STATUSES = ["pending", "reviewed", "resolved"] as const;

export type SuggestionInput = {
    content: string;
    isAnonymous: boolean;
};

function validate(input: SuggestionInput): string | null {
    const content = input.content.trim();
    if (!content) return "Write your suggestion first.";
    if (content.length > MAX_LENGTH) return `Keep it under ${MAX_LENGTH} characters.`;
    return null;
}

export async function submitSuggestion(input: SuggestionInput): Promise<ActionResult> {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const viewer = await getViewer();
    await createSuggestion(viewer, { content: input.content.trim(), isAnonymous: input.isAnonymous });

    refresh();
    return { success: true };
}

// Authors can only edit while the suggestion is still pending.
export async function updateSuggestion(id: string, input: SuggestionInput): Promise<ActionResult> {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const viewer = await getViewer();
    const saved = await editSuggestion(viewer.id, id, { content: input.content.trim(), isAnonymous: input.isAnonymous });
    if (!saved) {
        return { error: "Couldn't save your changes. The council may have already reviewed this suggestion." };
    }

    refresh();
    return { success: true };
}

export async function deleteSuggestion(id: string): Promise<ActionResult> {
    const viewer = await getViewer();
    if (!(await removeSuggestion(viewer.id, id))) {
        return { error: "Couldn't delete this suggestion. Please try again." };
    }

    refresh();
    return { success: true };
}

// Admin-only.
export async function setSuggestionStatus(id: string, status: string): Promise<ActionResult> {
    const nextStatus = STATUSES.find((s) => s === status);
    if (!nextStatus) return { error: "Unknown status." };

    const viewer = await getViewer();
    if (!viewer.isAdmin) return { error: "Only council admins can change a suggestion's status." };

    if (!(await changeStatus(id, nextStatus))) {
        return { error: "Couldn't update the status. Please try again." };
    }

    refresh();
    return { success: true };
}
