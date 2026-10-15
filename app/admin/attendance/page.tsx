export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, isAdmin } from "@/lib/auth";
import { checkInState } from "@/lib/attendance";
import { fetchAttendanceEvents } from "@/lib/attendance-server";

export const metadata: Metadata = {
  title: "Event Attendance — SOE Hub",
};

// Unstyled on purpose: backend-first scaffold for the frontend team to restyle.
export default async function AdminAttendancePage() {
  const [, admin] = await Promise.all([getProfile(), isAdmin()]);
  if (!admin) redirect("/home");

  const events = await fetchAttendanceEvents();

  return (
    <main>
      <h1>Event attendance</h1>
      <p>
        <Link href="/admin">Admin console</Link> · <Link href="/attendance/scan">Scan students</Link>
      </p>
      {events.length === 0 ? (
        <p>No events yet. Create them on the calendar.</p>
      ) : (
        <table border={1}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Starts</th>
              <th>Check-in</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.event_id}>
                <td>{event.event_name}</td>
                <td>{new Date(event.event_start).toLocaleString()}</td>
                <td>{checkInState(event)}</td>
                <td><Link href={`/admin/attendance/${event.event_id}`}>Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
