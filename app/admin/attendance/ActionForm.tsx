"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import ConfirmDialog from "@/app/home/ConfirmDialog";
import type { ActionResult } from "@/lib/actionResult";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

export type ConfirmOptions = { title: string; message: string; confirmLabel: string };

/**
 * A plain form around an admin action that shows its result. datetime-local
 * inputs are sent as ISO strings so the server never guesses the time zone.
 * `className` lays out the fields; the result message goes underneath.
 */
export default function ActionForm({
  action,
  children,
  successMessage = "Saved.",
  confirm,
  className = "",
}: {
  action: Action;
  children: ReactNode;
  successMessage?: string;
  confirm?: ConfirmOptions;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]').forEach((input) => {
      formData.set(input.name, input.value ? new Date(input.value).toISOString() : "");
    });
    return action(prev, formData);
  }, {});

  const errors = [state.error, ...Object.values(state.fieldErrors ?? {})].filter(Boolean) as string[];

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (!confirm) return;
        // The dialog resubmits the form once confirmed.
        if (confirmedRef.current) {
          confirmedRef.current = false;
          return;
        }
        e.preventDefault();
        setConfirming(true);
      }}
    >
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

      {confirming && confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            confirmedRef.current = true;
            formRef.current?.requestSubmit();
          }}
        />
      )}
    </form>
  );
}
