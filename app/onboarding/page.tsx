import { OnboardingPortal } from "@/components/onboarding/OnboardingPortal";

export const metadata = {
  title: "Owner-Operator Onboarding | Twin Mile LLC",
  description: "Complete your onboarding in 7 steps: Identity, FMCSA, Background Check, E-Sign, Documents, Insurance, Account Creation.",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-6">
        <OnboardingPortal />
      </div>
    </main>
  );
}