export const instant = false;

import type { Metadata } from "next";
import styles from "../scaffold.module.css";
import Link from "next/link";
import { getProfile, isAdmin } from "@/lib/auth";
import { fetchScannableEvents } from "@/lib/attendance-server";
import Scanner from "./Scanner";

export const metadata: Metadata = {
  title: "Scan Attendance — SOE Hub",
};

// Bare-bones on purpose: backend-first scaffold for the frontend team to restyle.
export default async function ScanPage() {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  const events = await fetchScannableEvents(profile.id, admin);

  return (
    <main className={styles.scaffold}>
      <h1>Scan attendance</h1>
      <p><Link href="/attendance">Back to attendance</Link></p>
      {events.length === 0 ? (
        <p>You aren&apos;t assigned to scan for any upcoming or ongoing events.</p>
      ) : (
        <Scanner events={events} />
      )}
    </main>
  );
}
