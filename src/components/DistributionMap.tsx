"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ProvinceDistribution } from "@/data/distribution";

const INDONESIA_CENTER: [number, number] = [-2.3, 118];
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim();
const CARTO_URL = CARTO_KEY
  ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_KEY)}`
  : null;
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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

function MapSizeController() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;
    const updateSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);
    document.addEventListener("visibilitychange", updateSize);
    updateSize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
      document.removeEventListener("visibilitychange", updateSize);
      cancelAnimationFrame(frame);
    };
  }, [map]);

  return null;
}

export function DistributionMap(props: DistributionMapProps) {
  const [tileSource, setTileSource] = useState<"carto" | "osm">(CARTO_URL ? "carto" : "osm");
  const [tileError, setTileError] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const tileFailures = useRef(0);

  const handleTileError = () => {
    if (tileSource === "carto") {
      tileFailures.current = 0;
      setTileSource("osm");
      return;
    }
    tileFailures.current += 1;
    if (tileFailures.current >= 3) setTileError(true);
  };

  const retryTiles = () => {
    tileFailures.current = 0;
    setTileError(false);
    setTileAttempt((attempt) => attempt + 1);
  };

  return (
    <div className="relative">
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
        key={`${tileSource}-${tileAttempt}`}
        attribution={tileSource === "carto"
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        url={tileSource === "carto" && CARTO_URL ? CARTO_URL : OSM_URL}
        eventHandlers={{
          tileerror: handleTileError,
          tileload: () => {
            tileFailures.current = 0;
            setTileError(false);
          },
        }}
      />
      <MapSizeController />
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
    {tileError && <div role="alert" className="absolute left-4 top-4 z-[400] max-w-xs rounded-xl border border-amber-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg">
      <p className="font-bold text-amber-800">Peta dasar belum dapat dimuat</p>
      <p className="mt-1 leading-5">Periksa koneksi atau pemblokiran gambar pihak ketiga di browser. Data desa tetap tersedia di bawah peta.</p>
      <button type="button" onClick={retryTiles} className="mt-2 font-bold text-[#D84315] hover:underline">Coba lagi</button>
    </div>}
    </div>
  );
}
