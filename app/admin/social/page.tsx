import { SocialPacksClient } from "@/components/admin/social-packs-client";

export const metadata = {
  title: "Social Posts | Twin Mile Admin",
};

export const dynamic = "force-dynamic";

export default function AdminSocialPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <SocialPacksClient />
    </main>
  );
}
