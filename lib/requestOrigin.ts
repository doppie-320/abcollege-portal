import "server-only";
import { headers } from "next/headers";

function firstValue(header: string | null): string | undefined {
  return header?.split(",")[0]?.trim() || undefined;
}

/**
 * The site this request came in on, e.g. https://www.soe-hub.app, so links in
 * emails point back to the same deployment (and so the same Supabase project).
 * Browsers send Origin with every server action; the Host headers are the fallback.
 */
export async function requestOrigin(): Promise<string | undefined> {
  const headerList = await headers();

  const origin = headerList.get("origin");
  if (origin && origin !== "null") return origin;

  const host = firstValue(headerList.get("x-forwarded-host")) ?? firstValue(headerList.get("host"));
  if (!host) return undefined;

  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = firstValue(headerList.get("x-forwarded-proto")) ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Where email links land (see app/auth/callback). It has to be on the Supabase
 * project's Redirect URLs list; Supabase falls back to the Site URL otherwise,
 * which the proxy forwards to the callback.
 */
export async function authCallbackUrl(): Promise<string | undefined> {
  const origin = await requestOrigin();
  return origin ? `${origin}/auth/callback` : undefined;
}
