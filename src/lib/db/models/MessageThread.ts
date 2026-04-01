import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMessageThread extends Document {
  listingId: Types.ObjectId;
  participants: [Types.ObjectId, Types.ObjectId];
  lastMessageAt: Date;
  createdAt: Date;
}

const MessageThreadSchema = new Schema<IMessageThread>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: (v: Types.ObjectId[]) => v.length === 2,
        message: "A thread must have exactly 2 participants",
      },
      required: true,
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageThreadSchema.index({ participants: 1 });
MessageThreadSchema.index({ listingId: 1, participants: 1 });

const MessageThread: Model<IMessageThread> =
  mongoose.models.MessageThread ||
  mongoose.model<IMessageThread>("MessageThread", MessageThreadSchema);

export default MessageThread;
