"use client";

export const instant = false;

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Media =
  | { type: "image"; src: string; alt: string }
  | { type: "video"; label: string; duration: string };

type Announcement = {
  tag: string;
  tagVariant?: "orange";
  postedAt: string;
  title: string;
  body: string;
  media?: Media;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    tag: "FINANCE",
    tagVariant: "orange",
    postedAt: "POSTED 2H AGO",
    title: "Org dues balance reminder — ₱150",
    body: "Students with an outstanding balance for AY 2026–2027 have until Oct 15 to settle at the SOE office before fines apply.",
  },
  {
    tag: "EVENT",
    postedAt: "POSTED 1D AGO",
    title: "Engineering Days 2026 registration is open",
    body: "Sign up for the sportsfest and talent night lineups through your block representative. Slots are first come, first served.",
    media: { type: "image", src: "/promo-bg.png", alt: "Engineering Days 2026 banner" },
  },
  {
    tag: "ACADEMIC",
    postedAt: "POSTED 3D AGO",
    title: "Midterm requirements deadline moved to Oct 20",
    body: "Department heads approved a one-week extension following the class suspensions last week. Submit through your respective faculty.",
  },
  {
    tag: "GENERAL",
    postedAt: "POSTED 5D AGO",
    title: "General assembly minutes now posted",
    body: "Catch up on what was discussed at last week's GA under Transparency Reports on the sidebar.",
    media: { type: "video", label: "GA_recording.mp4", duration: "42:10" },
  },
];

function formatDateLine(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${weekday}, ${month} ${date.getDate()} ${date.getFullYear()}`;
}

type HomeContentProps = {
  last_name: string,
  first_name: string,
}

export default async function HomeContent({last_name, first_name,}: HomeContentProps) {
  const [dateLine, setDateLine] = useState("");

  useEffect(() => {
    setDateLine(formatDateLine(new Date()));
  }, []);

  return (
    <>
      <header className="site-header">
        <Link href="/home" className="brand brandLink">
          <Image
            src="/logo.png"
            alt="Andres Bonifacio College seal"
            width={28}
            height={28}
            className="seal"
          />
          SOE HUB
        </Link>
        <nav className="main-nav">
          <Link href="/home" className="current">Home</Link>
          <Link href="#">Calendar</Link>
          <Link href="#">Attendance</Link>
          <Link href="#">Suggestion Box</Link>
          <Link href="#">Transparency Reports</Link>
        </nav>
        <Link href="#" className="user-chip">
          <span className="dot">JD</span> {first_name} {last_name}
        </Link>
      </header>
      <div className="header-accent"></div>

      <div className="page-wrap">
        <div className="hero">
          <div className="heroTop">
            <h1>SOE&apos;s HAPPENING</h1>

            <div className="socialLinks">
              <Link href="#" aria-label="SOE on Facebook">
                <FacebookIcon />
              </Link>
              <Link href="#" aria-label="SOE on Messenger">
                <MessengerIcon />
              </Link>
              <Link href="#" aria-label="SOE on Instagram">
                <InstagramIcon />
              </Link>
            </div>
          </div>

          <div className="date mono">{dateLine}</div>
        </div>

        <div className="layout">
          <div className="tick-frame">
            <span className="tick-bl"></span>
            <span className="tick-br"></span>
            <span className="eyebrow">ANNOUNCEMENTS</span>

            {ANNOUNCEMENTS.map((item) => (
              <div key={item.title} className="announceItem">
                <div className="announceMeta">
                  <span className={`tag ${item.tagVariant ?? ""}`}>{item.tag}</span>
                  <span className="mono">{item.postedAt}</span>
                </div>

                <h3>{item.title}</h3>
                <p>{item.body}</p>

                {item.media && (
                  <div className="media">
                    {item.media.type === "image" ? (
                      <Image
                        src={item.media.src}
                        alt={item.media.alt}
                        width={800}
                        height={456}
                        className="mediaImage"
                      />
                    ) : (
                      <div className="videoPlaceholder">
                        <span className="playButton">
                          <PlayIcon />
                        </span>
                        <span className="videoLabel">{item.media.label}</span>
                        <span className="videoDuration mono">{item.media.duration}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <h4>Transparency reports</h4>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Financial reports and GA minutes will show up here.</p>
              </div>
            </div>

            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <h4>Birthdays today</h4>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Today&apos;s celebrants, pulled from the SOE calendar.</p>
              </div>
            </div>

            <div className="sideBlock tick-frame">
              <span className="tick-bl"></span>
              <span className="tick-br"></span>
              <h4>Countdown</h4>
              <div className="comingSoon">
                <span className="badge">COMING SOON</span>
                <p>Events within 7 days will count down here.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .brandLink {
          font-size: 16px;
        }

        .seal {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          object-fit: contain;
        }

        .hero {
          margin-bottom: 28px;
        }

        .heroTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .hero h1 {
          font-size: 44px;
          margin-bottom: 0;
          line-height: 1;
        }

        .date {
          font-size: 13px;
          color: var(--ink-soft);
          margin-top: 4px;
        }

        .socialLinks {
          display: flex;
          gap: 10px;
        }

        .socialLinks a {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .socialLinks svg {
          display: block;
        }

        .socialLinks a:hover {
          background: var(--blue);
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 28px;
          align-items: start;
        }

        .announceItem {
          padding: 28px 0;
          border-top: 1px solid #c9bfa0;
        }

        .announceItem:first-child {
          border-top: none;
          padding-top: 0;
        }

        .announceItem h3 {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .announceMeta {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--ink-soft);
          margin-bottom: 8px;
        }

        .announceMeta .mono {
          font-family: "IBM Plex Mono", monospace;
        }

        .announceItem p {
          font-size: 14px;
          color: var(--ink);
          margin-bottom: 0;
        }

        .media {
          margin-top: 12px;
          border: 1px solid #c9bfa0;
          background: var(--vellum-2);
          overflow: hidden;
        }

        .mediaImage {
          display: block;
          width: 100%;
          height: auto;
        }

        .videoPlaceholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 16px;
        }

        .playButton {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--navy);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .videoLabel {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }

        .videoDuration {
          font-size: 11.5px;
          color: var(--ink-soft);
        }

        .sideBlock {
          margin-bottom: 22px;
        }

        .sideBlock:last-child {
          margin-bottom: 0;
        }

        .sideBlock h4 {
          font-size: 14px;
          margin-bottom: 4px;
        }

        .comingSoon {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 22px 0 6px;
          color: var(--ink-soft);
        }

        .comingSoon .badge {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          padding: 3px 7px;
          border: 1px dashed #c9bfa0;
          color: var(--ink-soft);
        }

        .comingSoon p {
          font-size: 12.5px;
          margin: 6px 0 0;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.14 2 11.25c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.92.38 5.52 0 10-4.14 10-9.27S17.52 2 12 2Zm1 12.5-2.55-2.72-4.98 2.72L10.9 8.9l2.62 2.72L18.4 8.9Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
