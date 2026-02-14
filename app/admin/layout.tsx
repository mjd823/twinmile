import Link from "next/link";
import React from "react";

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

  // Hide sidebar on login page
  const isLoginPage = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && 
    (child as any).props?.segment === 'login'
  );

  if (!isAdmin) {
    return <div className="mx-auto w-full max-w-7xl px-5 py-6">{children}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6">
      {!isLoginPage && <AdminMobileNav />}

      {!isLoginPage && (
        <div className="flex gap-6">
          <AdminSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      )}

      {isLoginPage && (
        <div className="min-w-0 flex-1">{children}</div>
      )}
    </div>
  );
}
