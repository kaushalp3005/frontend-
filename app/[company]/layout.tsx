"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuthStore, type Company } from "@/lib/stores/auth";
import { AppLayout } from "@/components/layout/app-layout";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams() as { company?: string };
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  const company = isClient ? (params?.company || "").toUpperCase() : "";
  const {
    user,
    isLoading,
    currentCompany,
    currentCompanyAccess,
    setCurrentCompany,
  } = useAuthStore();

  // Kick off permissions load when company changes
  useEffect(() => {
    if (!isClient) return;
    if (!company) return;
    if (!user) return; // auth not ready yet, let your global auth loader handle this

    // Only fetch if we aren't already on this company or if access is unset
    const needFetch =
      currentCompany !== company || !currentCompanyAccess || currentCompanyAccess.code !== company;

    if (needFetch) {
      console.log("[LAYOUT] setCurrentCompany →", company);
      setCurrentCompany(company as Company);
    }
  }, [isClient, company, user, currentCompany, currentCompanyAccess, setCurrentCompany]);

  // Check if user has access to current company
  useEffect(() => {
    if (!isClient) return;
    if (!user || isLoading) return;

    // Check company access
    const userCompanies = user.companies || [];
    const hasCompanyAccess = userCompanies.some((c: any) => c.code === company);

    if (company && !hasCompanyAccess) {
      console.warn('[LAYOUT] User does not have access to company:', company);
      router.push('/403');
    }
  }, [isClient, user, company, isLoading, router]);

  // Decide what to render based on loading + access
  const gate = useMemo(() => {
    if (!isClient) return { state: "loading" as const, reason: "Client-side hydration" };
    if (!user) return { state: "auth-wait" as const, reason: "No user yet" };
    if (isLoading) return { state: "loading" as const, reason: "Store loading" };
    if (!company) return { state: "error" as const, reason: "No company in route" };

    // If we're currently switching companies or loading permissions, show loading state
    if (currentCompany !== company) {
      return { state: "loading" as const, reason: "Loading company permissions" };
    }

    if (!currentCompanyAccess || currentCompanyAccess.code !== company) {
      return { state: "loading" as const, reason: "Waiting for permissions to load" };
    }

    // Optional: ensure at least dashboard access exists
    // Only check if we have currentCompanyAccess and it matches the current company
    if (currentCompanyAccess && currentCompanyAccess.code === company) {
      const hasDashboard = currentCompanyAccess.modules?.some(
        (m: any) => m.moduleCode === "dashboard" && m.permissions?.access
      );
      if (!hasDashboard) {
        console.warn('[LAYOUT] No dashboard access, redirecting to 403');
        router.push('/403');
        return { state: "error" as const, reason: "No dashboard access" };
      }
    }

    return { state: "ok" as const, reason: "Ready" };
  }, [isClient, user, isLoading, company, currentCompany, currentCompanyAccess, router]);

  if (gate.state === "loading" || gate.state === "auth-wait") {
    return (
      <div className="w-full h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-3 sm:border-4 border-current border-t-transparent" />
          <p className="text-xs sm:text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (gate.state === "error") {
    console.warn("[LAYOUT] Gate error:", gate.reason, {
      user,
      company,
      currentCompanyAccess,
      pathname,
    });
    return (
      <div className="w-full h-screen flex items-center justify-center p-4">
        <div className="max-w-sm sm:max-w-md w-full rounded-xl border p-4 sm:p-6 space-y-3">
          <h2 className="text-base sm:text-lg font-semibold">Can't load this company</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {gate.reason}. Check the console (F12 → Console) for details. If you just applied the backend
            fix, hit refresh once.
          </p>
          <div className="pt-2">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs sm:text-sm"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // OK → render the app with header and sidebar
  return (
    <AppLayout company={company as Company}>
      {children}
    </AppLayout>
  );
}
