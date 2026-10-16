export const instant = false;

import type { Metadata } from "next";
import styles from "./scaffold.module.css";
import Link from "next/link";
import { getProfile, isAdmin } from "@/lib/auth";
import { canScanAnything, fetchMyAttendance, isStudent } from "@/lib/attendance-server";
import StudentToken from "./StudentToken";

export const metadata: Metadata = {
  title: "Attendance — SOE Hub",
};

// Bare-bones on purpose: backend-first scaffold for the frontend team to restyle.
export default async function AttendancePage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  const [student, canScan, history] = await Promise.all([
    isStudent(profile.id),
    canScanAnything(profile.id, admin),
    fetchMyAttendance(profile.id),
  ]);

  return (
    <main className={styles.scaffold}>
      <h1>Attendance</h1>
      <p>Signed in as {profile.name}</p>
      <ul>
        {canScan && <li><Link href="/attendance/scan">Scan students</Link></li>}
        {admin && <li><Link href="/admin/attendance">Manage event attendance</Link></li>}
      </ul>

      <h2>My attendance code</h2>
      {student ? (
        <StudentToken />
      ) : (
        <p>Only students have an attendance code.</p>
      )}

      {student && (
        <>
          <h2>My history</h2>
          {history.length === 0 ? (
            <p>No attendance recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Event date</th>
                  <th>Status</th>
                  <th>Recorded</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={`${row.event_name}-${row.recorded_at}`}>
                    <td>{row.event_name}</td>
                    <td>{new Date(row.event_start).toLocaleString()}</td>
                    <td>{row.status}</td>
                    <td>{new Date(row.recorded_at).toLocaleString()} ({row.method})</td>
                    <td>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
