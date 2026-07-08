import { CallSheetClient } from "@/components/admin/call-sheet-client";

export const metadata = {
  title: "Call Sheet | Twin Mile Admin",
};

export const dynamic = "force-dynamic";

export default function AdminCallSheetPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-5">
      <CallSheetClient />
    </main>
  );
}
