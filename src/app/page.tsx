"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ShieldIcon, HandshakeIcon, StarIcon } from "@/components/icons";
import { SkeletonCard } from "@/components/ui/Skeleton";
const Hero3D = dynamic(() => import("@/components/hero/Hero3D"), { ssr: false });
const IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";
interface FL { _id: string; title: string; monthlyRent: number; currency: string; photos: string[]; address: { city: string; country: string }; propertyType: string; }
export default function HomePage() {
  const [featured, setFeatured] = useState<FL[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/listings/featured").then(r => r.json()).then(d => setFeatured(d.listings || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (<div className="min-h-screen bg-[var(--background)]">
    <section className="relative h-[70vh] overflow-hidden flex items-center justify-center bg-gradient-to-br from-navy-50 via-white to-navy-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="absolute inset-0 z-0" style={{width:"100%",height:"100%"}}><Hero3D /></div>
      <div className="relative z-10 glass-premium rounded-2xl p-8 md:p-12 max-w-2xl mx-4 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">Find Your Home in Europe</h1>
        <p className="text-lg text-[var(--text-secondary)] mb-6">Safe, trusted apartment hunting for expats.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/search" className="px-6 py-3 bg-navy-500 text-white rounded-xl text-sm font-medium hover:bg-navy-600 btn-press">Start Searching</Link>
          <Link href="/listings/new" className="px-6 py-3 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--background-secondary)] btn-press">Post a Listing</Link>
        </div>
      </div>
    </section>
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {[{icon:<ShieldIcon size={40} className="text-navy-500"/>,t:"Scam Protection",d:"AI-powered scam detection analyzes every listing"},{icon:<HandshakeIcon size={40} className="text-navy-500"/>,t:"Dual-Party Payments",d:"Escrow-based payments require confirmation from both parties"},{icon:<StarIcon size={40} className="text-navy-500"/>,t:"Trust Scores",d:"Community-driven trust system with verified reviews"}].map(f=>(<div key={f.t} className="glass-card text-center"><span className="mb-3 flex justify-center">{f.icon}</span><h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{f.t}</h3><p className="text-sm text-[var(--text-secondary)]">{f.d}</p></div>))}
      </div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Featured Listings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>) : featured.length === 0 ? <div className="col-span-full glass-card text-center py-12"><p className="text-[var(--text-muted)] mb-4">No featured listings yet</p><Link href="/search" className="text-navy-500 hover:underline">Browse all listings</Link></div> : featured.map(l=>(<a key={l._id} href={"/listings/"+l._id} className="glass-card card-hover block cursor-pointer relative z-10" style={{textDecoration:"none",color:"inherit"}}><img src={l.photos?.[0]||IMG} alt={l.title} className="w-full h-40 object-cover rounded-lg mb-3" loading="lazy"/><h3 className="font-semibold text-[var(--text-primary)] truncate">{l.title}</h3><p className="text-sm text-[var(--text-secondary)]">{l.address?.city}, {l.address?.country}</p><div className="flex items-center justify-between mt-2"><span className="text-lg font-bold text-navy-500">{l.currency} {l.monthlyRent}/mo</span><span className="text-xs px-2 py-1 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">{l.propertyType}</span></div></a>))}
      </div>
    </section>
  </div>);
}
