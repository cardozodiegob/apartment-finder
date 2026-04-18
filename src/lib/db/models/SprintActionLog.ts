import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { AGENT_ROLES, type AgentRole } from "@/lib/sprint/types";

export type SprintActionLogOutcome =
  | "ok"
  | "rejected_unknown_tool"
  | "rejected_not_allowed"
  | "rejected_invalid_params"
  | "execution_error";

const SPRINT_ACTION_LOG_OUTCOMES: readonly SprintActionLogOutcome[] = [
  "ok",
  "rejected_unknown_tool",
  "rejected_not_allowed",
  "rejected_invalid_params",
  "execution_error",
] as const;

export interface ISprintActionLog extends Document {
  timestamp: Date;
  sprintId: Types.ObjectId;
  agentRole: AgentRole;
  toolName: string;
  /** sha256 of JSON.stringify(parameters) */
  parameterDigest: string;
  outcome: SprintActionLogOutcome;
  errorMessage?: string;
  /** Only set when SPRINT_VERBOSE_LOGS=true. */
  rawParameters?: unknown;
  /** Only set when SPRINT_VERBOSE_LOGS=true. */
  rawResponse?: unknown;
}

const SprintActionLogSchema = new Schema<ISprintActionLog>(
  {
    timestamp: { type: Date, default: Date.now, required: true },
    sprintId: { type: Schema.Types.ObjectId, ref: "Sprint", required: true },
    agentRole: {
      type: String,
      enum: [...AGENT_ROLES],
      required: true,
    },
    toolName: { type: String, required: true },
    parameterDigest: { type: String, required: true },
    outcome: {
      type: String,
      enum: [...SPRINT_ACTION_LOG_OUTCOMES],
      required: true,
    },
    errorMessage: { type: String },
    rawParameters: { type: Schema.Types.Mixed },
    rawResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

SprintActionLogSchema.index({ sprintId: 1, timestamp: 1 });
SprintActionLogSchema.index({ sprintId: 1, agentRole: 1, timestamp: 1 });

const SprintActionLog: Model<ISprintActionLog> =
  mongoose.models.SprintActionLog ||
  mongoose.model<ISprintActionLog>("SprintActionLog", SprintActionLogSchema);

export default SprintActionLog;
