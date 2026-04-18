import type { Metadata } from "next";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { firstPhotoUrl, photoUrls, type PhotoValue } from "@/lib/listings/photoUrl";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://apartmentfinder.com";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    await dbConnect();
    const listing = await Listing.findById(id).lean();
    if (!listing) return { title: "Listing Not Found" };

    const title = `${listing.title} — ${listing.address.city} | ApartmentFinder`;
    const description = `${listing.propertyType} for ${listing.purpose} in ${listing.address.city}, ${listing.address.country}. ${listing.currency} ${listing.monthlyRent}/month.`;
    const url = `${BASE_URL}/listings/${id}`;
    const image = firstPhotoUrl(listing.photos as PhotoValue[]) || `${BASE_URL}/file.svg`;
    const allImages = photoUrls(listing.photos as PhotoValue[]);

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "RentalListing" as const,
      name: listing.title,
      description: listing.description,
      url,
      image: allImages.length > 0 ? allImages : [image],
      offers: {
        "@type": "Offer",
        price: listing.monthlyRent,
        priceCurrency: listing.currency,
        availability: "https://schema.org/InStock",
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: listing.address.street,
        addressLocality: listing.address.city,
        postalCode: listing.address.postalCode,
        addressCountry: listing.address.country,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: listing.location.coordinates[1],
        longitude: listing.location.coordinates[0],
      },
    };

    return {
      title,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title,
        description,
        url,
        type: "website",
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
    return { title: "Listing | ApartmentFinder" };
  }
}

export default function ListingLayout({ children }: Props) {
  return <>{children}</>;
}
