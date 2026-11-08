import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

// What Supabase puts on a link it sends back to the site.
const AUTH_LINK_PARAMS = ["code", "token_hash", "error_code"];

export async function proxy(request: NextRequest) {
  // When a link's redirect isn't on Supabase's Redirect URLs list (or none was
  // given), Supabase sends it to the Site URL instead: the root, which used to
  // redirect to /login and drop the code without a word. Finish it in the
  // callback, which also explains a link that can't be used.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && AUTH_LINK_PARAMS.some((param) => searchParams.has(param))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - PWA files - sw.js, offline.html, *.webmanifest. Browsers fetch manifests
     *   without cookies, so the login redirect would otherwise break app installs.
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
