import { MarketingShell } from "@/components/layout/MarketingShell";
import { LandingPage } from "@/features/landing/LandingPage";

export default function Home() {
  return (
    <MarketingShell>
      <LandingPage />
    </MarketingShell>
  );
}
