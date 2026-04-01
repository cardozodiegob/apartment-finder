"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LocationPickerMapProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    // Fix gray tiles on initial render
    const timer = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);
    if (lat !== 0 || lng !== 0) {
      map.setView([lat, lng], map.getZoom() < 13 ? 15 : map.getZoom());
    }
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ lat, lng, onLocationChange }: LocationPickerMapProps) {
  const center: [number, number] = lat !== 0 || lng !== 0 ? [lat, lng] : [48.8566, 2.3522];

  return (
    <MapContainer center={center} zoom={lat !== 0 || lng !== 0 ? 15 : 5} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <MapClickHandler onLocationChange={onLocationChange} />
      <RecenterMap lat={lat} lng={lng} />
      {(lat !== 0 || lng !== 0) && <Marker position={[lat, lng]} />}
    </MapContainer>
  );
}
