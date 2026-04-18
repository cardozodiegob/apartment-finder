import dbConnect from "@/lib/db/connection";
import BlogArticle from "@/lib/db/models/BlogArticle";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://apartmentfinder.com";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  await dbConnect();
  const articles = await BlogArticle.find({ isPublished: true }, { slug: 1, updatedAt: 1 }).lean();

  const urls = articles.map((a) => {
    const loc = `${BASE_URL}/blog/${a.slug}`;
    return `<url>
  <loc>${escapeXml(loc)}</loc>
  <lastmod>${new Date(a.updatedAt).toISOString()}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.6</priority>
</url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
