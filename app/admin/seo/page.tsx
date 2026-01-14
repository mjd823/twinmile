import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "SEO Checklist",
  robots: { index: false, follow: false },
};

export default async function AdminSeoPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  redirect("/admin/settings");
}
