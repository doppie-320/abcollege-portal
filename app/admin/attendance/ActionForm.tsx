"use client";

import { useActionState, useRef, type ReactNode } from "react";
import { settle, type ActionResult } from "@/lib/actionResult";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * A plain form around an admin action that shows its result. datetime-local
 * inputs are sent as ISO strings so the server never guesses the time zone.
 * `className` lays out the fields; the result message goes underneath.
 *
 * `optimistic` runs inside the action's transition, before the request, so a
 * useOptimistic setter called there shows the change at once. It reverts by
 * itself when the request ends; the refreshed page data takes over on success.
 */
export default function ActionForm({
  action,
  optimistic,
  children,
  successMessage = "Saved.",
  className = "",
}: {
  action: Action;
  optimistic?: (formData: FormData) => void;
  children: ReactNode;
  successMessage?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData): Promise<ActionResult> => {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]').forEach((input) => {
      formData.set(input.name, input.value ? new Date(input.value).toISOString() : "");
    });
    optimistic?.(formData);
    return settle(action(prev, formData));
  }, {});

  const errors = [state.error, ...Object.values(state.fieldErrors ?? {})].filter(Boolean) as string[];

  return (
    <form ref={formRef} action={formAction}>
      <fieldset disabled={pending} className={`m-0 min-w-0 border-none p-0 ${className}`}>
        {children}
      </fieldset>

      {errors.map((message) => (
        <p key={message} role="alert" className="animate-fade-in mt-2 mb-0 flex items-start gap-1.5 text-[12px] font-medium text-[#b3261e]">
          <span aria-hidden="true">&#9888;</span>
          {message}
        </p>
      ))}
      {state.success && !pending && errors.length === 0 && (
        <p role="status" className="animate-fade-in mono mt-2 mb-0 text-[11px] text-blue">
          &#10003; {successMessage}
        </p>
      )}
    </form>
  );
}
