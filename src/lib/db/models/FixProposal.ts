import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  AGENT_ROLES,
  FILE_CHANGE_OPERATIONS,
  FIX_STATUSES,
  VERIFICATION_OVERALL_STATUSES,
  VERIFICATION_STEP_NAMES,
  VERIFICATION_STEP_STATUSES,
  type AgentRole,
  type FileChangeOperation,
  type FixStatus,
  type VerificationOverallStatus,
  type VerificationStepName,
  type VerificationStepStatus,
} from "@/lib/sprint/types";

export interface IFileChange {
  path: string;
  operation: FileChangeOperation;
  addedLines: number;
  removedLines: number;
  diff: string;
}

interface IEmbeddedVerificationStep {
  name: VerificationStepName;
  status: VerificationStepStatus;
  durationMs: number;
  output: string;
}

interface IEmbeddedVerificationReport {
  fixProposalId: string;
  overall: VerificationOverallStatus;
  steps: IEmbeddedVerificationStep[];
  startedAt: Date;
  completedAt: Date;
}

export type FixRejectReason =
  | "verification_failed"
  | "security_review_blocked"
  | "timeout"
  | "verify_attempts_exhausted";

export interface IFixProposal extends Document {
  /** Human-facing id, format `P-<sprint_short>-<sequence>`. Unique per sprint. */
  id: string;
  sprintId: Types.ObjectId;
  findingIds: string[];
  authorAgentRole: AgentRole;
  title: string;
  fileChanges: IFileChange[];
  testPlan: string;
  status: FixStatus;
  rejectReason?: FixRejectReason;
  promotedSpecPath?: string;
  commitSha?: string;
  branch?: string;
  verificationAttempts: number;
  lastVerificationReport?: IEmbeddedVerificationReport;
  createdAt: Date;
  updatedAt: Date;
}

const FileChangeSchema = new Schema<IFileChange>(
  {
    path: { type: String, required: true },
    operation: {
      type: String,
      enum: [...FILE_CHANGE_OPERATIONS],
      required: true,
    },
    addedLines: { type: Number, default: 0, min: 0 },
    removedLines: { type: Number, default: 0, min: 0 },
    diff: { type: String, default: "" },
  },
  { _id: false }
);

const EmbeddedVerificationStepSchema = new Schema<IEmbeddedVerificationStep>(
  {
    name: {
      type: String,
      enum: [...VERIFICATION_STEP_NAMES],
      required: true,
    },
    status: {
      type: String,
      enum: [...VERIFICATION_STEP_STATUSES],
      required: true,
    },
    durationMs: { type: Number, default: 0, min: 0 },
    output: { type: String, default: "" },
  },
  { _id: false }
);

const EmbeddedVerificationReportSchema =
  new Schema<IEmbeddedVerificationReport>(
    {
      fixProposalId: { type: String, required: true },
      overall: {
        type: String,
        enum: [...VERIFICATION_OVERALL_STATUSES],
        required: true,
      },
      steps: { type: [EmbeddedVerificationStepSchema], default: [] },
      startedAt: { type: Date, required: true },
      completedAt: { type: Date, required: true },
    },
    { _id: false }
  );

const FixProposalSchema = new Schema<IFixProposal>(
  {
    id: { type: String, required: true },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", required: true },
    findingIds: { type: [String], default: [] },
    authorAgentRole: {
      type: String,
      enum: [...AGENT_ROLES],
      required: true,
    },
    title: { type: String, required: true },
    fileChanges: { type: [FileChangeSchema], default: [] },
    testPlan: { type: String, default: "" },
    status: {
      type: String,
      enum: [...FIX_STATUSES],
      default: "draft",
      required: true,
    },
    rejectReason: {
      type: String,
      enum: [
        "verification_failed",
        "security_review_blocked",
        "timeout",
        "verify_attempts_exhausted",
      ],
    },
    promotedSpecPath: { type: String },
    commitSha: { type: String },
    branch: { type: String },
    verificationAttempts: { type: Number, default: 0, min: 0 },
    lastVerificationReport: { type: EmbeddedVerificationReportSchema },
  },
  { timestamps: true }
);

FixProposalSchema.index({ sprintId: 1, status: 1, createdAt: 1 });
FixProposalSchema.index({ sprintId: 1, id: 1 }, { unique: true });

const FixProposal: Model<IFixProposal> =
  mongoose.models.FixProposal ||
  mongoose.model<IFixProposal>("FixProposal", FixProposalSchema);

export default FixProposal;
