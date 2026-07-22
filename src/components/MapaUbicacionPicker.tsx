import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ASUNCION: [number, number] = [-25.2637, -57.5759];

const PIN = L.divIcon({
  className: "",
  html:
    '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
    'background:#2563eb;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/**
 * Selector de ubicación sobre mapa Leaflet. Muestra un pin arrastrable; también
 * se puede tocar el mapa para reposicionarlo. Emite (lat, lng) al soltar/tocar.
 * Sincroniza el pin cuando lat/lng cambian desde afuera (inputs / botón GPS).
 */
export function MapaUbicacionPicker({
  lat, lng, onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Init una sola vez
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const tieneCoord = lat != null && lng != null;
    const center: [number, number] = tieneCoord ? [lat!, lng!] : ASUNCION;
    const map = L.map(divRef.current).setView(center, tieneCoord ? 16 : 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker(center, { draggable: true, icon: PIN }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onChangeRef.current(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar pin/vista cuando lat/lng cambian desde afuera
  useEffect(() => {
    if (lat == null || lng == null || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16));
  }, [lat, lng]);

  return (
    <div
      ref={divRef}
      className="h-64 w-full rounded-xl overflow-hidden border border-border"
    />
  );
}
