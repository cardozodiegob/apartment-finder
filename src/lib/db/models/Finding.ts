import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  type AgentRole,
  type CustomerPersona,
  type FindingCategory,
  type FindingSeverity,
} from "@/lib/sprint/types";

export interface IFinding extends Document {
  /** Human-facing id, format `F-<sprint_short>-<sequence>`. Unique per sprint. */
  id: string;
  sprintId: Types.ObjectId;
  reporterAgentRole?: AgentRole;
  reporterPersona?: CustomerPersona;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  reproductionSteps: string[];
  evidenceUrls: string[];
  /** sha256(category|title|joined reproduction steps) */
  dedupSignature: string;
  duplicateCount: number;
  createdAt: Date;
}

const FindingSchema = new Schema<IFinding>(
  {
    id: { type: String, required: true },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", required: true },
    reporterAgentRole: { type: String, enum: [...AGENT_ROLES] },
    reporterPersona: { type: String, enum: [...CUSTOMER_PERSONAS] },
    category: {
      type: String,
      enum: [...FINDING_CATEGORIES],
      required: true,
    },
    severity: {
      type: String,
      enum: [...FINDING_SEVERITIES],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reproductionSteps: { type: [String], default: [] },
    evidenceUrls: { type: [String], default: [] },
    dedupSignature: { type: String, required: true },
    duplicateCount: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

FindingSchema.index({ sprintId: 1, createdAt: 1 });
FindingSchema.index({ sprintId: 1, severity: 1, category: 1 });
FindingSchema.index({ sprintId: 1, id: 1 }, { unique: true });
FindingSchema.index({ sprintId: 1, dedupSignature: 1 }, { unique: true });

const Finding: Model<IFinding> =
  mongoose.models.Finding || mongoose.model<IFinding>("Finding", FindingSchema);

export default Finding;
