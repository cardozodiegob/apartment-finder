import Report from "@/lib/db/models/Report";
import User from "@/lib/db/models/User";
import Listing from "@/lib/db/models/Listing";
import type { IReport, ReportCategory } from "@/lib/db/models/Report";
import { z } from "zod";

// --- Types ---

export const reportInputSchema = z.object({
  reporterId: z.string().min(1),
  reportedUserId: z.string().optional(),
  reportedListingId: z.string().optional(),
  category: z.enum(["suspected_scam", "misleading_information", "harassment", "other"]),
  description: z.string().min(1).max(5000),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

const SCAM_SUSPENSION_THRESHOLD = 3;

// --- Service ---

export async function createReport(data: ReportInput): Promise<{ report: IReport | null; error: string | null }> {
  const parsed = reportInputSchema.safeParse(data);
  if (!parsed.success) {
    return { report: null, error: parsed.error.errors[0].message };
  }

  try {
    const report = await Report.create(parsed.data);

    // Set reported listing to "under_review"
    if (parsed.data.reportedListingId) {
      await Listing.findByIdAndUpdate(parsed.data.reportedListingId, {
        status: "under_review",
      });
    }

    return { report, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create report";
    return { report: null, error: msg };
  }
}

export async function resolveReport(
  reportId: string,
  adminId: string,
  resolution: string,
  confirmed: boolean
): Promise<{ report: IReport | null; error: string | null }> {
  try {
    const report = await Report.findById(reportId);
    if (!report) return { report: null, error: "Report not found" };

    report.status = "resolved";
    report.resolution = resolution;
    report.resolvedBy = adminId as unknown as import("mongoose").Types.ObjectId;
    report.resolvedAt = new Date();
    await report.save();

    // If confirmed scam, increment poster's confirmed scam reports
    if (confirmed && report.reportedUserId) {
      const user = await User.findById(report.reportedUserId);
      if (user) {
        user.confirmedScamReports += 1;
        if (user.confirmedScamReports >= SCAM_SUSPENSION_THRESHOLD) {
          user.isSuspended = true;
          user.suspensionReason = `Account suspended: ${user.confirmedScamReports} confirmed scam reports`;
          await user.save();
          // Remove all active listings
          await Listing.updateMany(
            { posterId: report.reportedUserId, status: "active" },
            { status: "archived" }
          );
        } else {
          await user.save();
        }
      }
    }

    return { report, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to resolve report";
    return { report: null, error: msg };
  }
}

export async function getReports(
  status?: string
): Promise<{ reports: IReport[]; error: string | null }> {
  try {
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    const reports = await Report.find(query).sort({ createdAt: 1 }); // oldest first
    return { reports, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get reports";
    return { reports: [], error: msg };
  }
}

export function shouldSuspendUser(confirmedReports: number): boolean {
  return confirmedReports >= SCAM_SUSPENSION_THRESHOLD;
}
