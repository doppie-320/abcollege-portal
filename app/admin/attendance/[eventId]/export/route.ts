import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { fetchAttendanceCsv } from "@/lib/attendance-server";

export async function GET(_req: NextRequest, ctx: RouteContext<"/admin/attendance/[eventId]/export">) {
  if (!(await isAdmin())) return new Response("Only admins can export attendance.", { status: 403 });

  const eventId = Number((await ctx.params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return new Response("Unknown event.", { status: 404 });

  const csv = await fetchAttendanceCsv(eventId);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-event-${eventId}.csv"`,
    },
  });
}
