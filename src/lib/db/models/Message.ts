import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMessage extends Document {
  threadId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "MessageThread",
      required: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ threadId: 1, createdAt: 1 });

const Message: Model<IMessage> =
  mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
