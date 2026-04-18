import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMessageTranslation extends Document {
  messageId: Types.ObjectId;
  targetLanguage: string;
  translatedBody: string;
  sourceLanguage?: string;
  provider?: string;
  createdAt: Date;
}

const MessageTranslationSchema = new Schema<IMessageTranslation>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    targetLanguage: { type: String, required: true, lowercase: true },
    translatedBody: { type: String, required: true },
    sourceLanguage: { type: String, lowercase: true },
    provider: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

MessageTranslationSchema.index(
  { messageId: 1, targetLanguage: 1 },
  { unique: true },
);

const MessageTranslation: Model<IMessageTranslation> =
  mongoose.models.MessageTranslation ||
  mongoose.model<IMessageTranslation>("MessageTranslation", MessageTranslationSchema);

export default MessageTranslation;
