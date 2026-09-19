import type { Metadata } from "next";
import HomeContent from "./HomeContent";

export const metadata: Metadata = {
  title: "Home — SOE Hub",
};

export default function HomePage() {
  return <HomeContent />;
}
