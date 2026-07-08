import { ListenerClient } from "@/components/admin/listener-client";

export const metadata = {
  title: "Sofia the Listener | Twin Mile Admin",
};

export const dynamic = "force-dynamic";

export default function AdminListenerPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-5">
      <ListenerClient />
    </main>
  );
}
