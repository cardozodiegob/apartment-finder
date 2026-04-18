import Link from "next/link";
import { ShieldIcon, HandshakeIcon, StarIcon } from "@/components/icons";
import HomeHeroClient from "@/components/home/HomeHeroClient";
import PopularCitiesGrid from "@/components/home/PopularCitiesGrid";
import FeaturedListingsGrid from "@/components/home/FeaturedListingsGrid";
import HomeBlogStrip from "@/components/home/HomeBlogStrip";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import BlogArticle from "@/lib/db/models/BlogArticle";

// Revalidate homepage every 30 minutes (ISR). Override via `dynamic = "force-dynamic"`.
export const revalidate = 1800;

interface CityCount {
  city: string;
  country: string;
  count: number;
}

async function getPopularCities(): Promise<CityCount[]> {
  try {
    await dbConnect();
    const rows = await Listing.aggregate<{ _id: { city: string; country: string }; count: number }>([
      { $match: { status: "active" } },
      { $group: { _id: { city: "$address.city", country: "$address.country" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);
    return rows.map((r) => ({ city: r._id.city, country: r._id.country, count: r.count }));
  } catch {
    return [];
  }
}

async function getFeaturedListings() {
  try {
    await dbConnect();
    const docs = await Listing.find({ status: "active", isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    return docs.map((d) => ({
      _id: String(d._id),
      title: d.title,
      monthlyRent: d.monthlyRent,
      currency: d.currency,
      photos: (d.photos as unknown as { url: string; order: number }[] | string[]) ?? [],
      address: d.address,
      propertyType: d.propertyType,
    }));
  } catch {
    return [];
  }
}

async function getBlogArticles() {
  try {
    await dbConnect();
    const docs = await BlogArticle.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();
    return docs.map((d) => ({
      slug: d.slug,
      title: d.title,
      featuredImageUrl: d.featuredImageUrl,
      publishedAt: d.publishedAt,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [cities, featured, blog] = await Promise.all([
    getPopularCities(),
    getFeaturedListings(),
    getBlogArticles(),
  ]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero with search form — client island */}
      <HomeHeroClient />

      {/* Trust strip */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: <ShieldIcon size={40} className="text-navy-500" />, t: "Scam Protection", d: "AI-powered scam detection analyzes every listing" },
            { icon: <HandshakeIcon size={40} className="text-navy-500" />, t: "Dual-Party Payments", d: "Escrow-based payments require confirmation from both parties" },
            { icon: <StarIcon size={40} className="text-navy-500" />, t: "Trust Scores", d: "Community-driven trust system with verified reviews" },
          ].map((f) => (
            <div key={f.t} className="glass-card text-center">
              <span className="mb-3 flex justify-center">{f.icon}</span>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{f.t}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{f.d}</p>
            </div>
          ))}
        </div>

        {/* Popular cities grid (SSR'd from Mongo aggregation) */}
        {cities.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Popular cities</h2>
            <PopularCitiesGrid cities={cities} />
          </div>
        )}

        {/* How it works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { n: "1", t: "Search", d: "Filter by city, budget, and amenities." },
              { n: "2", t: "Message", d: "Chat safely with verified posters." },
              { n: "3", t: "Move in", d: "Escrow-backed payment keeps both sides protected." },
            ].map((step) => (
              <div key={step.n} className="glass-card">
                <div className="w-10 h-10 rounded-full bg-navy-500 text-white flex items-center justify-center text-lg font-bold mb-3">
                  {step.n}
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{step.t}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{step.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Featured listings */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Featured listings</h2>
          <FeaturedListingsGrid listings={featured} />
        </div>

        {/* Latest blog */}
        {blog.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">From the blog</h2>
            <HomeBlogStrip articles={blog} />
          </div>
        )}
      </section>

      {/* Homepage JSON-LD */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "ApartmentFinder",
            url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://apartmentfinder.com",
            potentialAction: {
              "@type": "SearchAction",
              target: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/search?query={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
    </div>
  );
}
