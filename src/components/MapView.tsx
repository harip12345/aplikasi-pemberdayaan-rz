"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { mapLocations } from "@/data/dashboard";

const marker = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function MapView() {
  return (
    <MapContainer center={[-2.5, 118]} zoom={5} scrollWheelZoom={false} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapLocations.map((location) => (
        <Marker key={location.name} position={[location.latitude, location.longitude]} icon={marker}>
          <Popup>
            <div className="min-w-[180px]">
              <p className="font-semibold">{location.name}</p>
              <p>{location.city}</p>
              <p>{location.type}</p>
              <p>Penerima manfaat: {location.beneficiaries}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
