import { AdminNavigation } from "@/components/admin/admin-navigation";
import type { AdminSession } from "@/types/dealership";
import { env, hasAdminSuperEmailConfig } from "@/lib/env";

export function AdminShell({
  session,
  children,
}: {
  session: AdminSession;
  children: React.ReactNode;
}) {
  const canManageAdmins =
    hasAdminSuperEmailConfig &&
    session.email.toLowerCase() === env.adminSuperEmail.toLowerCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <AdminNavigation session={session} canManageAdmins={canManageAdmins} />
      <div className="min-w-0">
        <main className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
