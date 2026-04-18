import type { Metadata } from "next";
import dbConnect from "@/lib/db/connection";
import BlogArticle from "@/lib/db/models/BlogArticle";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://apartmentfinder.com";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    await dbConnect();
    const article = await BlogArticle.findOne({ slug, isPublished: true }).lean();
    if (!article) return { title: "Article Not Found" };

    const title = `${article.title} | ApartmentFinder Blog`;
    const description = article.body.replace(/<[^>]+>/g, "").slice(0, 160);
    const url = `${BASE_URL}/blog/${slug}`;
    const image = article.featuredImageUrl || `${BASE_URL}/file.svg`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description,
      url,
      image,
      datePublished: article.publishedAt?.toISOString(),
      dateModified: article.updatedAt?.toISOString(),
    };

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        type: "article",
        images: [{ url: image }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
      other: {
        "script:ld+json": JSON.stringify(jsonLd),
      },
    };
  } catch {
    return { title: "Blog | ApartmentFinder" };
  }
}

export default function BlogArticleLayout({ children }: Props) {
  return <>{children}</>;
}
