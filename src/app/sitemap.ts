import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import BlogArticle from "@/lib/db/models/BlogArticle";
import NeighborhoodGuide from "@/lib/db/models/NeighborhoodGuide";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://apartmentfinder.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await dbConnect();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/register`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Active listings
  const listings = await Listing.find({ status: "active" }, { _id: 1, updatedAt: 1 }).lean();
  const listingPages: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${BASE_URL}/listings/${l._id}`,
    lastModified: l.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Published blog articles
  const articles = await BlogArticle.find({ isPublished: true }, { slug: 1, updatedAt: 1 }).lean();
  const blogPages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE_URL}/blog/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Published neighborhood guides
  const guides = await NeighborhoodGuide.find({ isPublished: true }, { city: 1, neighborhood: 1, updatedAt: 1 }).lean();
  const guidePages: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${BASE_URL}/neighborhoods/${encodeURIComponent(g.city)}/${encodeURIComponent(g.neighborhood)}`,
    lastModified: g.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...listingPages, ...blogPages, ...guidePages];
}
