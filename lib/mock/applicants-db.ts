export type ApplicantStatus = "pending" | "approved" | "declined";

export type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  yearLevel: string;
  birthday?: string;
  studentId: string;
  program: string;
  status: ApplicantStatus;
  submittedAt: string;
};

export const STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
};

const UNKNOWN = "—";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const APPLICANTS: Applicant[] = [
  {
    id: "a-001",
    firstName: "Maria",
    lastName: "Santos",
    email: "maria.santos@abcollege.edu.ph",
    yearLevel: "3rd Year",
    birthday: "2004-02-14",
    studentId: "2026-00142",
    program: "BS Information Technology",
    status: "pending",
    submittedAt: "2026-09-28T02:15:00.000Z",
  },
  {
    id: "a-002",
    firstName: "Carlo",
    lastName: "Ramos",
    email: "carlo.ramos@abcollege.edu.ph",
    yearLevel: "4th Year",
    birthday: "2003-08-02",
    studentId: "2026-00143",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-27T09:40:00.000Z",
  },
  {
    id: "a-003",
    firstName: "Anna",
    lastName: "Dizon",
    email: "anna.dizon@abcollege.edu.ph",
    yearLevel: "2nd Year",
    birthday: "2005-11-30",
    studentId: "2026-00144",
    program: "BS Business Administration",
    status: "pending",
    submittedAt: "2026-09-26T14:05:00.000Z",
  },
  {
    id: "a-004",
    firstName: "Leo",
    lastName: "Fernandez",
    email: "leo.fernandez@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00145",
    program: "BS Civil Engineering",
    status: "pending",
    submittedAt: "2026-09-25T06:20:00.000Z",
  },
  {
    id: "a-005",
    firstName: "Bea",
    lastName: "Aquino",
    email: "bea.aquino@abcollege.edu.ph",
    yearLevel: "3rd Year",
    birthday: "2004-05-19",
    studentId: "2026-00146",
    program: "BS Accountancy",
    status: "approved",
    submittedAt: "2026-09-22T11:00:00.000Z",
  },
  {
    id: "a-006",
    firstName: "Rafael",
    lastName: "Mendoza",
    email: "rafael.mendoza@abcollege.edu.ph",
    yearLevel: "2nd Year",
    birthday: "2005-01-07",
    studentId: "2026-00147",
    program: "BS Information Technology",
    status: "pending",
    submittedAt: "2026-09-21T03:55:00.000Z",
  },
  {
    id: "a-007",
    firstName: "Nicole",
    lastName: "Vera",
    email: "nicole.vera@abcollege.edu.ph",
    yearLevel: "4th Year",
    birthday: "2003-09-25",
    studentId: "2026-00148",
    program: "BS Education",
    status: "declined",
    submittedAt: "2026-09-18T08:30:00.000Z",
  },
  {
    id: "a-008",
    firstName: "Joshua",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
  {
    id: "a-009",
    firstName: "Anthony",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
  {
    id: "a-010",
    firstName: "Solonski",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
  {
    id: "a-011",
    firstName: "Rex",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
  {
    id: "a-012",
    firstName: "Iya",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
  {
    id: "a-013",
    firstName: "Huh",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
  {
    id: "a-014",
    firstName: "huhu",
    lastName: "Lim",
    email: "joshua.lim@abcollege.edu.ph",
    yearLevel: "1st Year",
    studentId: "2026-00149",
    program: "BS Computer Engineering",
    status: "pending",
    submittedAt: "2026-09-16T13:10:00.000Z",
  },
];

export function fetchApplicants(): Applicant[] {
  return APPLICANTS.map((applicant) => ({ ...applicant }));
}

export function applicantName(applicant: Applicant): string {
  return `${applicant.firstName} ${applicant.lastName}`.trim() || UNKNOWN;
}

export function applicantInitials(applicant: Applicant): string {
  return `${applicant.firstName.charAt(0)}${applicant.lastName.charAt(0)}`.toUpperCase() || "?";
}

export function applicantBirthday(applicant: Applicant): string {
  return applicant.birthday?.trim() || UNKNOWN;
}

export function formatSubmittedDate(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}