/**
 * Admin sprints layout.
 *
 * Gates every route under `/admin/sprints/*` with `requireAdmin()`. The
 * session guard throws `ApiErrorResponse` on anonymous (401) or
 * non-admin (403) requests; we redirect to the login page in both
 * cases so the user lands somewhere actionable rather than seeing a
 * raw 403 render.
 *
 * Requirements: 9.8, 9.9
 */

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/api/session";

export default async function SprintsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/sprints");
  }
  return <>{children}</>;
}
