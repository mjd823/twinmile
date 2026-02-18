import Link from "next/link";
import React from "react";
import { headers } from "next/headers";

import { getAuthUser } from "@/lib/auth/session";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";

async function isAdminUser(): Promise<boolean> {
  try {
    const user = await getAuthUser();
    return user?.role === "admin";
  } catch {
    return false;
  }
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminUser();
  
  // Check if current page is login by looking at pathname
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isLoginPage = pathname.includes("/admin/login") || pathname === "/admin/login";

  if (!isAdmin) {
    return <div className="mx-auto w-full max-w-7xl px-5 py-6">{children}</div>;
  }

  return (
    <div className="w-full min-h-screen">
      {!isLoginPage && <AdminMobileNav />}

      {!isLoginPage && (
        <div className="flex">
          <AdminSidebar />
          <div className="min-w-0 flex-1 p-6">{children}</div>
        </div>
      )}

      {isLoginPage && (
        <div className="mx-auto w-full max-w-7xl px-5 py-6">{children}</div>
      )}
    </div>
  );
}
