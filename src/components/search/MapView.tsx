"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue with webpack
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  location: { coordinates: [number, number] };
}

export default function MapView({ listings }: { listings: MapListing[] }) {
  const center: [number, number] = listings.length > 0
    ? [listings[0].location.coordinates[1], listings[0].location.coordinates[0]]
    : [48.8566, 2.3522]; // Default: Paris

  return (
    <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {listings.map((listing) => (
        <Marker key={listing._id} position={[listing.location.coordinates[1], listing.location.coordinates[0]]}>
          <Popup>
            <strong>{listing.title}</strong><br />
            {listing.currency} {listing.monthlyRent}/mo
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
