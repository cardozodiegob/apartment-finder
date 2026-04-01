"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    // Wait for container to be fully rendered then recalculate size
    const timer = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [map]);
  return null;
}

interface ListingDetailMapProps {
  lat: number;
  lng: number;
}

export default function ListingDetailMap({ lat, lng }: ListingDetailMapProps) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
      <InvalidateSizeOnMount />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Marker position={[lat, lng]} />
    </MapContainer>
  );
}
