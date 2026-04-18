import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://apartmentfinder.com";
const LOCALES = ["en", "de", "es", "fr", "it", "pt"];

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  await dbConnect();
  const listings = await Listing.find({ status: "active" }, { _id: 1, updatedAt: 1 }).lean();

  const urls = listings.map((l) => {
    const loc = `${BASE_URL}/listings/${l._id}`;
    const alts = LOCALES
      .map((lo) => `<xhtml:link rel="alternate" hreflang="${lo}" href="${BASE_URL}/${lo}/listings/${l._id}"/>`)
      .join("");
    return `<url>
  <loc>${escapeXml(loc)}</loc>
  <lastmod>${new Date(l.updatedAt).toISOString()}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
  ${alts}
</url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
