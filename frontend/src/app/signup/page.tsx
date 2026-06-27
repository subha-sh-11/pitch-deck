import type { Metadata } from "next";
import { SignupPage } from "@/features/auth/SignupPage";

export const metadata: Metadata = {
  title: "Get Started · Pitch Deck Studio",
  description:
    "Create your free Pitch Deck Studio account and turn your script into a cinematic, investor-ready deck.",
};

export default function Page() {
  return <SignupPage />;
}
