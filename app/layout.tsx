import type { Metadata } from "next";
import "./globals.css";
import StyledJsxRegistry from "./registry";
import Toaster from "@/components/Toaster";
import NavigationProgress from "@/components/NavigationProgress";

export const metadata: Metadata = {
  title: "SOE Hub",
  description:
    "Announcements, transparency reports, attendance, and everything else the School of Engineering student council needs you to see — in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <NavigationProgress />
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
        <Toaster />
      </body>
    </html>
  );
}
