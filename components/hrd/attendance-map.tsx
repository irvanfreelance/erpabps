"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const officeIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const userIcon = L.divIcon({
  className: "custom-user-marker",
  html: `<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export function AttendanceMap({
  userLat,
  userLng,
  locLat,
  locLng,
  radiusMeter,
}: {
  userLat: number | null;
  userLng: number | null;
  locLat: number | null;
  locLng: number | null;
  radiusMeter: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[260px] w-full rounded-2xl bg-[#f0f0f0] animate-pulse" />;
  }

  // Tentukan pusat peta
  let center: [number, number] = [-6.2, 106.8]; // default Jakarta
  let zoom = 16;
  if (userLat != null && userLng != null) {
    center = [userLat, userLng];
  } else if (locLat != null && locLng != null) {
    center = [locLat, locLng];
  }

  return (
    <MapContainer center={center} zoom={zoom} className="h-[260px] w-full rounded-2xl z-0" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />
      {/* Lingkaran radius lokasi penempatan */}
      {locLat != null && locLng != null && (
        <>
          <Marker position={[locLat, locLng]} icon={officeIcon} />
          <Circle
            center={[locLat, locLng]}
            radius={radiusMeter}
            pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2 }}
          />
        </>
      )}
      {/* Posisi user saat ini */}
      {userLat != null && userLng != null && (
        <Marker position={[userLat, userLng]} icon={userIcon} />
      )}
    </MapContainer>
  );
}
