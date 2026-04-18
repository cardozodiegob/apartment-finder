import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type BlogCategory = "moving_guides" | "city_guides" | "rental_tips" | "expat_life";

export interface IBlogArticle extends Document {
  title: string;
  slug: string;
  body: string;
  category: BlogCategory;
  authorId: Types.ObjectId;
  featuredImageUrl?: string;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlogArticleSchema = new Schema<IBlogArticle>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    body: { type: String, required: true },
    category: {
      type: String,
      enum: ["moving_guides", "city_guides", "rental_tips", "expat_life"],
      required: true,
    },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    featuredImageUrl: { type: String },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

BlogArticleSchema.index({ slug: 1 }, { unique: true });
BlogArticleSchema.index({ isPublished: 1, publishedAt: -1 });
BlogArticleSchema.index({ category: 1, isPublished: 1 });

const BlogArticle: Model<IBlogArticle> =
  mongoose.models.BlogArticle ||
  mongoose.model<IBlogArticle>("BlogArticle", BlogArticleSchema);

export default BlogArticle;
