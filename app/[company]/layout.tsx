"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuthStore, type Company } from "@/lib/stores/auth";
import { AppLayout } from "@/components/layout/app-layout";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams() as { company?: string };
  const pathname = usePathname();
  const [companyError, setCompanyError] = useState<string | null>(null);

  const company = (params?.company || "").toUpperCase();
  const {
    user,
    isLoading,
    currentCompany,
    currentCompanyAccess,
    setCurrentCompany,
    isDeveloperUser,
  } = useAuthStore();

  // Kick off permissions load when company changes
  useEffect(() => {
    if (!company) return;
    if (!user) return; // auth not ready yet, let your global auth loader handle this

    // Only fetch if we aren't already on this company or if access is unset
    const needFetch =
      currentCompany !== company || !currentCompanyAccess || currentCompanyAccess.code !== company;

    if (needFetch) {
      console.log("[LAYOUT] setCurrentCompany →", company);
      setCompanyError(null); // Clear previous errors
      setCurrentCompany(company as Company).catch((error) => {
        console.error("[LAYOUT] Failed to set company:", error);
        setCompanyError(error.message || `Failed to access ${company}. Please try again.`);
      });
    }
  }, [company, user, currentCompany, currentCompanyAccess, setCurrentCompany]);

  // Decide what to render based on loading + access
  const gate = useMemo(() => {
    if (!user) return { state: "auth-wait" as const, reason: "No user yet" };
    if (isLoading) return { state: "loading" as const, reason: "Store loading" };
    if (!company) return { state: "error" as const, reason: "No company in route" };
    
    // Check for company loading errors
    if (companyError) {
      return { state: "error" as const, reason: companyError };
    }

    // If we're currently switching companies or loading permissions, show loading state
    if (currentCompany !== company) {
      return { state: "loading" as const, reason: "Loading company permissions" };
    }

    if (!currentCompanyAccess || currentCompanyAccess.code !== company) {
      return { state: "loading" as const, reason: "Waiting for permissions to load" };
    }

    // Ensure at least dashboard access exists
    // Users with any valid company role (developer, admin, ops, approver, viewer)
    // always get dashboard access — it's the landing page.
    // Only block if user has NO role at all or modules are completely empty.
    const hasCompanyRole = isDeveloperUser() || !!currentCompanyAccess?.role;
    if (!hasCompanyRole) {
      const hasDashboard = currentCompanyAccess.modules?.some(
        (m: any) => m.moduleCode === "dashboard" && m.permissions?.access
      );
      if (!hasDashboard) {
        return { state: "error" as const, reason: "No dashboard access" };
      }
    }

    return { state: "ok" as const, reason: "Ready" };
  }, [user, isLoading, company, currentCompany, currentCompanyAccess, companyError, isDeveloperUser]);

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
    
    const handleRetry = async () => {
      if (company && user) {
        setCompanyError(null);
        try {
          await setCurrentCompany(company as Company);
        } catch (error: any) {
          console.error("[LAYOUT] Retry failed:", error);
          setCompanyError(error.message || `Failed to access ${company}. Please try again.`);
        }
      }
    };
    
    return (
      <div className="w-full h-screen flex items-center justify-center p-4">
        <div className="max-w-sm sm:max-w-md w-full rounded-xl border p-4 sm:p-6 space-y-3">
          <h2 className="text-base sm:text-lg font-semibold">Can't load this company</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {gate.reason}
          </p>
          <p className="text-xs text-muted-foreground/80">
            Check the console (F12 → Console) for details. If you just applied a backend fix, try refreshing or retrying.
          </p>
          <div className="pt-2 flex gap-2">
            <button
              onClick={handleRetry}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs sm:text-sm hover:bg-accent"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs sm:text-sm hover:bg-accent"
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
