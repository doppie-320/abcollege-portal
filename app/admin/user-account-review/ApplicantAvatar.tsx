import Image from "next/image";
import type { ReactNode } from "react";
import { applicantInitials, type Applicant } from "@/lib/applicants-db";

type ApplicantAvatarProps = {
  applicant: Applicant;
  /** Size, border and initials styling for the circle. */
  className: string;
  /** Largest rendered size in CSS pixels, so the right image width is fetched. */
  size: number;
  /** Overlays such as a status badge; they sit outside the photo's clipping. */
  children?: ReactNode;
};

/** The applicant's profile picture, or their initials when they haven't set one. */
export default function ApplicantAvatar({ applicant, className, size, children }: ApplicantAvatarProps) {
  return (
    <span className={`relative ${className}`}>
      {applicant.avatarUrl ? (
        <Image
          src={applicant.avatarUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="rounded-full object-cover"
        />
      ) : (
        applicantInitials(applicant)
      )}
      {children}
    </span>
  );
}
