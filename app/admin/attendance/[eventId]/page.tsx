export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile, isAdmin } from "@/lib/auth";
import { checkInState } from "@/lib/attendance";
import { fetchEventAttendance } from "@/lib/attendance-server";
import { assignScanner, removeAttendance, removeScanner, setAttendance } from "../actions";
import ActionForm from "../ActionForm";
import EventSettings from "./EventSettings";

export const metadata: Metadata = {
  title: "Event Attendance — SOE Hub",
};

// Unstyled on purpose: backend-first scaffold for the frontend team to restyle.
export default async function EventAttendancePage(props: PageProps<"/admin/attendance/[eventId]">) {
  const [, admin] = await Promise.all([getProfile(), isAdmin()]);
  if (!admin) redirect("/home");

  const eventId = Number((await props.params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const details = await fetchEventAttendance(eventId);
  if (!details) notFound();
  const { event, scanners, report } = details;
  const present = report.filter((row) => row.status === "present").length;

  return (
    <main>
      <p><Link href="/admin/attendance">All events</Link></p>
      <h1>{event.event_name}</h1>
      <p>
        {new Date(event.event_start).toLocaleString()} – {new Date(event.event_end).toLocaleString()} · Check-in:{" "}
        {checkInState(event)}
      </p>

      <h2>Settings</h2>
      <EventSettings event={event} />

      <h2>Scanners</h2>
      {scanners.length === 0 ? (
        <p>No scanners assigned. Admins can always scan.</p>
      ) : (
        <ul>
          {scanners.map((scanner) => (
            <li key={scanner.user_id}>
              <ActionForm action={removeScanner} successMessage="Removed.">
                {scanner.first_name} {scanner.last_name} ({scanner.email_address}){" "}
                <input type="hidden" name="eventId" value={event.event_id} />
                <input type="hidden" name="userId" value={scanner.user_id} />
                <button type="submit">Remove</button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={assignScanner} successMessage="Assigned.">
        <input type="hidden" name="eventId" value={event.event_id} />
        <label>
          Assign by email <input type="email" name="email" required />
        </label>{" "}
        <button type="submit">Assign</button>
      </ActionForm>

      <h2>Attendance ({present} present, {report.length - present} rejected)</h2>
      <p>
        <a href={`/admin/attendance/${event.event_id}/export`}>Export CSV</a>
      </p>
      {report.length === 0 ? (
        <p>Nobody has been recorded yet.</p>
      ) : (
        <table border={1}>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Course / year</th>
              <th>Status</th>
              <th>Recorded</th>
              <th>By</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.user_id}>
                <td>{row.student_id}</td>
                <td>{row.last_name}, {row.first_name}</td>
                <td>{row.course} / {row.year_level}</td>
                <td>{row.status}</td>
                <td>{new Date(row.recorded_at).toLocaleString()} ({row.method})</td>
                <td>{row.recorded_by}</td>
                <td>{row.note}</td>
                <td>
                  <ActionForm
                    action={removeAttendance}
                    successMessage="Removed."
                    confirm={`Remove ${row.first_name} ${row.last_name}'s record?`}
                  >
                    <input type="hidden" name="eventId" value={event.event_id} />
                    <input type="hidden" name="userId" value={row.user_id} />
                    <button type="submit">Remove</button>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Record manually</h3>
      <p>Overrides any existing record, e.g. for a student whose phone died.</p>
      <ActionForm action={setAttendance}>
        <input type="hidden" name="eventId" value={event.event_id} />
        <label>
          Student ID <input name="studentId" required />
        </label>{" "}
        <label>
          Status{" "}
          <select name="status" defaultValue="present">
            <option value="present">present</option>
            <option value="rejected">rejected</option>
          </select>
        </label>{" "}
        <label>
          Note <input name="note" />
        </label>{" "}
        <button type="submit">Save</button>
      </ActionForm>
    </main>
  );
}
