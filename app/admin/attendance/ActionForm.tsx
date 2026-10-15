"use client";

import { useActionState, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/lib/actionResult";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * A plain form around an admin action that shows its result. datetime-local
 * inputs are sent as ISO strings so the server never guesses the time zone.
 */
export default function ActionForm({
  action,
  children,
  successMessage = "Saved.",
  confirm,
}: {
  action: Action;
  children: ReactNode;
  successMessage?: string;
  confirm?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]').forEach((input) => {
      formData.set(input.name, input.value ? new Date(input.value).toISOString() : "");
    });
    return action(prev, formData);
  }, {});

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} style={{ border: "none", padding: 0, margin: 0, display: "inline" }}>
        {children}
      </fieldset>
      {state.error && <span role="alert"> {state.error}</span>}
      {state.fieldErrors &&
        Object.values(state.fieldErrors).map((message) => (
          <span key={message} role="alert"> {message}</span>
        ))}
      {state.success && !pending && <span role="status"> {successMessage}</span>}
    </form>
  );
}
