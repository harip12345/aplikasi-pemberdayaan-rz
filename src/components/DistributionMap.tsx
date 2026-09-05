"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ProvinceDistribution } from "@/data/distribution";

const INDONESIA_CENTER: [number, number] = [-2.3, 118];

function provinceIcon(province: ProvinceDistribution) {
  return L.divIcon({
    className: "distribution-marker",
    html: `<div style="min-width:44px;height:44px;padding:0 10px;border-radius:14px;background:#d84315;border:3px solid white;box-shadow:0 7px 16px rgba(15,23,42,.28);color:white;display:flex;align-items:center;justify-content:center;font:700 14px Arial;transition:transform .15s ease">${province.count}</div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
  });
}

type DistributionMapProps = {
  provinces: ProvinceDistribution[];
  focusResults: boolean;
  onProvinceSelect?: (province: ProvinceDistribution) => void;
};

function MapViewportController({ provinces, focusResults }: Pick<DistributionMapProps, "provinces" | "focusResults">) {
  const map = useMap();

  useEffect(() => {
    map.stop();

    if (!focusResults) {
      map.flyTo(INDONESIA_CENTER, 5, { animate: true, duration: 0.65 });
      return;
    }

    if (provinces.length === 1) {
      map.flyTo(provinces[0].center, 7, { animate: true, duration: 0.65 });
      return;
    }

    if (provinces.length > 1) {
      map.fitBounds(provinces.map((province) => province.center), {
        animate: true,
        duration: 0.65,
        maxZoom: 7,
        padding: [70, 70],
      });
    }
  }, [focusResults, map, provinces]);

  return null;
}

export function DistributionMap(props: DistributionMapProps) {
  return (
    <MapContainer
      center={INDONESIA_CENTER}
      zoom={5}
      minZoom={5}
      maxZoom={12}
      maxBounds={[[-11.5, 94], [6.5, 141.5]]}
      maxBoundsViscosity={1}
      scrollWheelZoom
      className="z-0 h-[680px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapViewportController provinces={props.provinces} focusResults={props.focusResults} />

      {props.provinces.map((province) => (
        <Marker
          key={province.id}
          position={province.center}
          icon={provinceIcon(province)}
          riseOnHover
          riseOffset={1000}
          eventHandlers={{ click: () => props.onProvinceSelect?.(province) }}
        >
          <Tooltip direction="top" offset={[0, -22]} opacity={1} sticky>
            <strong>{province.name}</strong><br />
            {province.count.toLocaleString("id-ID")} desa
          </Tooltip>
          <Popup>
            <div className="min-w-[190px]">
              <strong>{province.name}</strong>
              <p>{province.count} Desa Berdaya</p>
              <p>{province.activeCount} aktif</p>
            </div>
          </Popup>
        </Marker>
      ))}

    </MapContainer>
  );
}
