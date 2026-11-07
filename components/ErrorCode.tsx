import type { ErrorDetails } from "@/lib/authErrors";

/** The small "Code: … · Ref: …" line under an error message. */
export default function ErrorCode({ code, reference }: ErrorDetails) {
  if (!code) return null;

  return (
    <span className="mono mt-1 block text-[10.5px] [overflow-wrap:anywhere] text-ink-soft select-all">
      Code: {code}
      {reference && ` · Ref: ${reference}`}
    </span>
  );
}
