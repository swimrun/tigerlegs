import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Polyline, LayerGroup } from "leaflet";
import type { Segment, Trackpoint } from "../shared/types.ts";
import type { WaterBody } from "../client/water.ts";

interface Props {
  points: Trackpoint[];
  segments: Segment[];
  water: WaterBody[];
  active: number | null;
  select: (number: number) => void;
  preview: (number: number | null) => void;
}

export default function CourseMap({ points, segments, water, active, select, preview }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lines = useRef(new Map<number, Polyline>());
  const layers = useRef<{ course: LayerGroup; water: LayerGroup } | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ select, preview });
  callbacks.current = { select, preview };
  useEffect(() => {
    let disposed = false;
    void import("leaflet").then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current).setView([50, 5], 5);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
      }).addTo(instance);
      layers.current = { course: L.layerGroup().addTo(instance), water: L.layerGroup().addTo(instance) };
      leaflet.current = L;
      L.control.layers(undefined, { "Water (OpenStreetMap)": layers.current.water }, { collapsed: false }).addTo(instance);
      setReady(true);
    }).catch(error => {
      if (disposed) return;
      console.error("[TigerLegs] Map initialization failed", error);
      if (container.current) container.current.textContent = "Map unavailable. Segment results remain available.";
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      layers.current = null;
      leaflet.current = null;
      lines.current.clear();
    };
  }, []);
  useEffect(() => {
    const L = leaflet.current, instance = map.current, groups = layers.current;
    if (!ready || !L || !instance || !groups) return;
    groups.water.clearLayers();
    for (const body of water) {
      const ring = (r: WaterBody["outer"][number]): [number, number][] => r.map(c => [c.lat, c.lon]);
      for (const outer of body.outer) L.polygon([ring(outer), ...body.inner.map(ring)], {
        color: "#0288d1", weight: 1, fillColor: "#4fc3f7", fillOpacity: 0.35, interactive: false,
      }).addTo(groups.water);
    }
    groups.course.clearLayers();
    lines.current.clear();
    const coordinates: [number, number][] = points.map(p => [p.coordinate.lat, p.coordinate.lon]);
    // The segment colours are shared with the training week: they come from the CSS variables of styles.css.
    const css = getComputedStyle(document.documentElement);
    const colorOf = (name: string) => css.getPropertyValue(name).trim() || "currentColor";
    const colors = { swim: colorOf("--color-swim"), run: colorOf("--color-run"), unclassified: colorOf("--color-unclassified") };
    if (!coordinates.length) return;
    if (!segments.length) L.polyline(coordinates, { color: colors.unclassified, weight: 4 }).addTo(groups.course);
    for (const segment of segments) {
      const line = L.polyline(coordinates.slice(segment.startTrackpointIndex, segment.endTrackpointIndex + 2), {
        color: colors[segment.type], weight: 4, opacity: 0.7,
      }).addTo(groups.course);
      line.on("mouseover", () => callbacks.current.preview(segment.number));
      line.on("mouseout", () => callbacks.current.preview(null));
      line.on("click", () => callbacks.current.select(segment.number));
      lines.current.set(segment.number, line);
    }
    instance.fitBounds(L.latLngBounds(coordinates));
  }, [ready, points, segments, water]);
  useEffect(() => {
    for (const [number, line] of lines.current) line.setStyle({
      weight: number === active ? 8 : 4, opacity: number === active ? 1 : 0.7,
    });
  }, [active, ready, points, segments, water]);
  return <div ref={container} id="map" className="z-0 h-[50vh] overflow-hidden rounded-lg border border-stone-200 shadow-sm lg:col-span-3 lg:h-[75vh]" />;
}
