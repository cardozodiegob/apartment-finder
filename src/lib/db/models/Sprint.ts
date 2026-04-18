import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  AGENT_ROLES,
  CUSTOMER_PERSONAS,
  LLM_PROVIDERS,
  SPRINT_RESULTS,
  SPRINT_STATUSES,
  type AgentRole,
  type CustomerPersona,
  type LlmProvider,
  type SprintResult,
  type SprintStatus,
} from "@/lib/sprint/types";

/**
 * Embedded per-agent record stored on each Sprint. Frozen at sprint start
 * (Requirement 2.7) — the manifest snapshot lives in `allowedTools` so a
 * mid-sprint manifest edit cannot expand a running agent's powers.
 */
export interface SprintAgentInstance {
  role: AgentRole;
  provider: LlmProvider;
  model: string;
  allowedTools: string[];
  tokensUsed: number;
}

export interface ISprint extends Document {
  status: SprintStatus;
  result?: SprintResult;
  goals: string[];
  durationMinutes: number;
  roles: AgentRole[];
  personas: CustomerPersona[];
  agents: SprintAgentInstance[];
  createdBy: Types.ObjectId;
  testDbName: string;
  testPort: number;
  tokenBudget: number;
  tokensUsed: number;
  hasCriticalFinding: boolean;
  currentBranchAtStart: string;
  startedAt?: Date;
  closingAt?: Date;
  completedAt?: Date;
  abortedAt?: Date;
  abortReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentInstanceSchema = new Schema<SprintAgentInstance>(
  {
    role: {
      type: String,
      enum: [...AGENT_ROLES],
      required: true,
    },
    provider: {
      type: String,
      enum: [...LLM_PROVIDERS],
      required: true,
    },
    model: { type: String, required: true },
    allowedTools: { type: [String], default: [] },
    tokensUsed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SprintSchema = new Schema<ISprint>(
  {
    status: {
      type: String,
      enum: [...SPRINT_STATUSES],
      default: "pending",
      required: true,
    },
    result: {
      type: String,
      enum: [...SPRINT_RESULTS],
    },
    goals: { type: [String], default: [] },
    durationMinutes: { type: Number, required: true, min: 5, max: 240 },
    roles: {
      type: [{ type: String, enum: [...AGENT_ROLES] }],
      default: [],
    },
    personas: {
      type: [{ type: String, enum: [...CUSTOMER_PERSONAS] }],
      default: [],
    },
    agents: { type: [AgentInstanceSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    testDbName: { type: String, required: true },
    testPort: { type: Number, required: true },
    tokenBudget: { type: Number, required: true, min: 0 },
    tokensUsed: { type: Number, default: 0, min: 0 },
    hasCriticalFinding: { type: Boolean, default: false },
    currentBranchAtStart: { type: String, required: true },
    startedAt: { type: Date },
    closingAt: { type: Date },
    completedAt: { type: Date },
    abortedAt: { type: Date },
    abortReason: { type: String },
  },
  { timestamps: true }
);

SprintSchema.index({ status: 1, createdAt: -1 });
SprintSchema.index({ createdBy: 1, createdAt: -1 });

// CRITICAL: enforces the single-running-sprint invariant at the DB layer
// (Requirement 12.6). Mongo allows at most one document where status="running".
SprintSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "running" } }
);

const Sprint: Model<ISprint> =
  mongoose.models.Sprint || mongoose.model<ISprint>("Sprint", SprintSchema);

export default Sprint;
