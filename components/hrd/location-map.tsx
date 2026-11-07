"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const ID_CENTER: [number, number] = [-2.5, 118];

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickMark({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }, [lat, lng, map]);
  return null;
}

export function LocationMap({
  latitude,
  longitude,
  radiusMeter,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  radiusMeter: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <div className="h-[360px] w-full rounded-xl bg-[#eee]" />;

  const has = latitude != null && longitude != null;
  const center: [number, number] = has ? [latitude, longitude] : ID_CENTER;
  return (
    <MapContainer
      center={center}
      zoom={has ? 16 : 5}
      className="h-[360px] w-full rounded-xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickMark onPick={onPick} />
      {has ? (
        <>
          <Recenter lat={latitude} lng={longitude} />
          <Marker
            icon={markerIcon}
            position={[latitude, longitude]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
          <Circle center={[latitude, longitude]} radius={radiusMeter} pathOptions={{ color: "#01665a", fillOpacity: 0.15 }} />
        </>
      ) : null}
    </MapContainer>
  );
}
