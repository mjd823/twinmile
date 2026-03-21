import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import {
  AdminLeaseAgreements,
  type LeaseAgreementSummary,
} from "@/components/admin/admin-lease-agreements";

export const metadata: Metadata = {
  title: "Lease Agreements",
  robots: { index: false, follow: false },
};

export default async function AdminLeaseAgreementsPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const raw = await db
    .collection("lease_agreements")
    .find(
      {},
      {
        sort: { createdAt: -1 },
        limit: 200,
        projection: {
          "operator.name": 1,
          "operator.mcNumber": 1,
          "operator.email": 1,
          "operator.phone": 1,
          "operator.address": 1,
          "operator.date": 1,
          status: 1,
          onboardingStep: 1,
          driverUserId: 1,
          "documents.cdl.name": 1,
          "documents.coi.name": 1,
          "documents.registration.name": 1,
          "documents.w9.name": 1,
          "documents.dotPhysical.name": 1,
          createdAt: 1,
        },
      }
    )
    .toArray();

  const agreements: LeaseAgreementSummary[] = raw.map((doc: any) => ({
    id: String(doc._id),
    operatorName: doc.operator?.name ?? "",
    operatorMcNumber: doc.operator?.mcNumber ?? "",
    operatorEmail: doc.operator?.email ?? "",
    operatorPhone: doc.operator?.phone ?? "",
    operatorAddress: doc.operator?.address ?? "",
    operatorDate: doc.operator?.date ?? "",
    status: doc.status ?? "pending_review",
    onboardingStep: doc.onboardingStep ?? doc.status ?? "pending_review",
    driverUserId: doc.driverUserId ? String(doc.driverUserId) : null,
    documentNames: {
      ...(doc.documents?.cdl?.name ? { cdl: doc.documents.cdl.name } : {}),
      ...(doc.documents?.coi?.name ? { coi: doc.documents.coi.name } : {}),
      ...(doc.documents?.registration?.name
        ? { registration: doc.documents.registration.name }
        : {}),
      ...(doc.documents?.w9?.name ? { w9: doc.documents.w9.name } : {}),
      ...(doc.documents?.dotPhysical?.name
        ? { dotPhysical: doc.documents.dotPhysical.name }
        : {}),
    },
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt ?? ""),
  }));

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Lease Agreements
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Owner-operator lease-on agreement submissions.
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {agreements.length} submission{agreements.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminLeaseAgreements agreements={agreements} />
        </div>
      </section>
    </main>
  );
}
