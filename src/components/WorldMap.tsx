import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Map,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  Coordinate,
  Measurement,
  NavigationPlan,
  ActivityType,
} from "../types";
import { useI18n } from "../i18n";
import {
  routingAvailable,
  routingProfile,
  routingService,
  searchDestinations,
} from "../services/routingService";
import { trafficService, type TrafficReport } from "../services/trafficService";
import { recentSpeed, routeProgress, userEta } from "../utils/navigation";
import { duration, number } from "../utils/formatters";
import { Metric, Toggle } from "./ui";
import { watchGps } from "../services/gpsService";
setWorkerUrl(workerUrl);
export interface MapProps {
  children?: ReactNode;
  measurements: Measurement[];
  mode?: ActivityType;
  elapsed?: number;
  paused?: boolean;
  navigation?: NavigationPlan;
  onNavigation?: (plan: NavigationPlan | undefined) => void;
}
const empty = (): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});
export default function WorldMap({
  measurements,
  children,
  mode = "run",
  elapsed = 0,
  paused = false,
  navigation,
  onNavigation,
}: MapProps) {
  const { t, language } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null);
  const change = useRef(onNavigation);
  const mapLocale = useRef({
    "Map.Title": t("route"),
    "NavigationControl.ZoomIn": t("zoomIn"),
    "NavigationControl.ZoomOut": t("zoomOut"),
    "AttributionControl.ToggleAttribution": t("mapAttribution"),
    "AttributionControl.MapFeedback": t("mapFeedback"),
  });
  const [ready, setReady] = useState(false),
    [mapError, setMapError] = useState(false);
  const [follow, setFollow] = useState(!!onNavigation);
  const [located, setLocated] = useState<Coordinate>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<
      { name: string; coordinate: Coordinate }[]
    >([]);
  const [searchError, setSearchError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [traffic, setTraffic] = useState<TrafficReport | null>(null);
  const stopLocation = useRef<() => void>(() => {});
  const request = useRef<AbortController | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    change.current = onNavigation;
  }, [onNavigation]);
  useEffect(() => {
    if (!host.current) return;
    let instance: Map;
    try {
      instance = new Map({
        container: host.current,
        locale: mapLocale.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-77.0428, -12.0464],
        zoom: 11,
      });
      map.current = instance;
      instance.addControl(new NavigationControl({ showCompass: false }));
      instance.on("error", () => setMapError(true));
      instance.on("load", () => {
        for (const id of ["track", "planned", "remaining", "markers"])
          instance.addSource(id, { type: "geojson", data: empty() });
        instance.addLayer({
          id: "planned",
          type: "line",
          source: "planned",
          paint: {
            "line-color": "#8ac8fa",
            "line-width": 5,
            "line-opacity": 0.75,
          },
        });
        instance.addLayer({
          id: "remaining",
          type: "line",
          source: "remaining",
          paint: {
            "line-color": "#ffffff",
            "line-width": 3,
            "line-dasharray": [2, 2],
          },
        });
        instance.addLayer({
          id: "track",
          type: "line",
          source: "track",
          paint: { "line-color": "#78a910", "line-width": 5 },
        });
        instance.addLayer({
          id: "markers",
          type: "circle",
          source: "markers",
          paint: {
            "circle-radius": 9,
            "circle-color": [
              "match",
              ["get", "label"],
              "Y",
              "#ff977b",
              "#c3f65b",
            ],
            "circle-stroke-color": "#152016",
            "circle-stroke-width": 3,
          },
        });
        instance.addLayer({
          id: "labels",
          type: "symbol",
          source: "markers",
          layout: { "text-field": ["get", "label"], "text-size": 12 },
          paint: { "text-color": "#111811" },
        });
        setReady(true);
        setMapError(false);
      });
      instance.on("click", (e) =>
        change.current?.({ destination: [e.lngLat.lng, e.lngLat.lat] }),
      );
      instance.on("dragstart", () => setFollow(false));
    } catch {
      setMapError(true);
      return;
    }
    return () => {
      instance.remove();
      map.current = null;
      stopLocation.current();
      request.current?.abort();
      searchRequest.current?.abort();
    };
  }, []);
  const points: Coordinate[] = measurements
    .filter((m) => m.latitude !== null && m.longitude !== null)
    .map((m) => [m.longitude!, m.latitude!]);
  const position = points.at(-1) ?? located;
  const destination = navigation?.destination;
  const route =
    navigation?.route?.profile === routingProfile(mode)
      ? navigation.route
      : undefined;
  const fitted = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const line = (coords: Coordinate[]): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features:
        coords.length < 2
          ? []
          : [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: coords },
              },
            ],
    });
    const segments: Coordinate[][] = [[]];
    let previousDistance: number | undefined;
    for (const sample of measurements) {
      if (sample.latitude === null || sample.longitude === null) continue;
      if (sample.break_before && segments.at(-1)!.length) segments.push([]);
      if (!sample.break_before && sample.distance === previousDistance)
        continue;
      previousDistance = sample.distance;
      segments.at(-1)!.push([sample.longitude, sample.latitude]);
    }
    (m.getSource("track") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: segments.flatMap((segment) => line(segment).features),
    });
    (m.getSource("planned") as GeoJSONSource).setData(
      line(route?.coordinates ?? []),
    );
    (m.getSource("remaining") as GeoJSONSource).setData(
      line(
        route && position
          ? routeProgress(position, route.coordinates).remainingCoordinates
          : [],
      ),
    );
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const origin = route?.coordinates[0] ?? points[0];
    if (origin)
      features.push({
        type: "Feature",
        properties: { label: "O" },
        geometry: { type: "Point", coordinates: origin },
      });
    if (position)
      features.push({
        type: "Feature",
        properties: { label: "X" },
        geometry: { type: "Point", coordinates: position },
      });
    if (destination)
      features.push({
        type: "Feature",
        properties: { label: "Y" },
        geometry: { type: "Point", coordinates: destination },
      });
    (m.getSource("markers") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    if (position && follow)
      m.easeTo({
        center: position,
        zoom: Math.max(14, m.getZoom()),
        duration: 400,
      });
    else if (!onNavigation && points.length && !fitted.current) {
      fitted.current = true;
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      m.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        { padding: 35, maxZoom: 16, duration: 0 },
      );
    }
  });
  const destinationKey = destination?.join(",");
  useEffect(() => {
    request.current?.abort();
    setBusy(false);
    setError(false);
    setTraffic(null);
  }, [destinationKey, mode]);
  const latestPosition = useRef(position);
  useEffect(() => {
    latestPosition.current = position;
  });
  const interactive = !!onNavigation;
  useEffect(() => {
    if (mode !== "vehicle" || !destinationKey || !interactive) return;
    const abort = new AbortController();
    const refresh = async () => {
      if (!latestPosition.current) return;
      const report = await trafficService.get(
        latestPosition.current,
        destinationKey.split(",").map(Number) as Coordinate,
        abort.signal,
      );
      if (!abort.signal.aborted) setTraffic(report);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => {
      abort.abort();
      window.clearInterval(timer);
    };
  }, [mode, destinationKey, interactive]);
  const progress =
    route && position ? routeProgress(position, route.coordinates) : null;
  const speed = paused ? 0 : recentSpeed(measurements, elapsed);
  const eta =
    progress && !progress.offRoute ? userEta(progress.remaining, speed) : null;
  const center = () => {
    if (position) {
      map.current?.easeTo({ center: position, zoom: 16 });
      setFollow(true);
      return;
    }
    setLocationError(false);
    stopLocation.current();
    stopLocation.current = watchGps(
      (p) => {
        const c: Coordinate = [p.longitude, p.latitude];
        setLocated(c);
        map.current?.easeTo({ center: c, zoom: 16 });
        stopLocation.current();
      },
      () => setLocationError(true),
    );
  };
  const calculate = async () => {
    if (!position || !destination) return;
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setBusy(true);
    setError(false);
    try {
      const route = await routingService.route(
        position,
        destination,
        mode,
        abort.signal,
      );
      if (!abort.signal.aborted) change.current?.({ destination, route });
    } catch {
      if (!abort.signal.aborted) setError(true);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="navigation-panel">
      {onNavigation && <p className="muted">{t("selectDestination")}</p>}
      <div
        ref={host}
        className="map-canvas"
        role="region"
        aria-label={t("route")}
      />
      {children}
      {locationError && (
        <p role="alert" className="notice">
          {t("locationUnavailable")}
        </p>
      )}
      {busy && <p role="status">{t("loading")}</p>}
      <p className="map-legend">{t("mapLegend")}</p>
      {mapError && (
        <p className="notice" role="status">
          {t("mapError")}
        </p>
      )}
      {onNavigation && (
        <>
          {!position && <p className="muted">{t("mapLocationInfo")}</p>}
          <button className="secondary-button full" onClick={center}>
            {t("centerMap")}
          </button>
          <Toggle label={t("follow")} checked={follow} onChange={setFollow} />
          {routingAvailable && (
            <form
              className="map-search"
              onSubmit={async (e) => {
                e.preventDefault();
                searchRequest.current?.abort();
                const abort = new AbortController();
                searchRequest.current = abort;
                setSearchError(false);
                try {
                  const found = await searchDestinations(query, abort.signal);
                  if (!abort.signal.aborted) {
                    setResults(found);
                    setSearchError(!found.length);
                  }
                } catch {
                  if (!abort.signal.aborted) setSearchError(true);
                }
              }}
            >
              <label>
                {t("searchDestination")}
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button className="secondary-button">{t("search")}</button>
            </form>
          )}
          {searchError && <p className="notice">{t("searchError")}</p>}
          {results.map((r, i) => (
            <button
              className="search-result"
              key={i}
              onClick={() => {
                onNavigation({ destination: r.coordinate });
                setResults([]);
                map.current?.easeTo({ center: r.coordinate, zoom: 15 });
                setFollow(false);
              }}
            >
              {r.name}
            </button>
          ))}
        </>
      )}
      {destination && (
        <>
          <p className="muted">
            Y · {t("destination")}: {destination[1].toFixed(5)},{" "}
            {destination[0].toFixed(5)}
          </p>
          {onNavigation && (
            <div className="account-actions">
              <button
                className="secondary-button"
                disabled={busy || !position || !routingAvailable}
                onClick={() => void calculate()}
              >
                {t("routeRequest")}
              </button>
              <button
                className="text-button"
                onClick={() => onNavigation(undefined)}
              >
                {t("clearDestination")}
              </button>
            </div>
          )}
          {!routingAvailable && !route && (
            <p className="notice">{t("routingUnavailable")}</p>
          )}
          {error && (
            <p className="notice" role="alert">
              {t("routeError")}
            </p>
          )}
          {progress?.offRoute && <p className="notice">{t("offRoute")}</p>}
          {route && (
            <div className="metric-grid card">
              <Metric
                label={t("routeDistance")}
                value={number(route.distance, language, 2)}
                unit={t("distanceUnit")}
              />
              <Metric
                label={t("providerEta")}
                value={duration(route.duration)}
              />
              {onNavigation && (
                <>
                  <Metric
                    label={t("remaining")}
                    value={
                      progress && !progress.offRoute
                        ? number(progress.remaining, language, 2)
                        : "—"
                    }
                    unit={t("distanceUnit")}
                  />
                  <Metric
                    label={t("filteredSpeed")}
                    value={number(speed, language)}
                    unit={t("speedUnit")}
                  />
                  <Metric
                    label={t("personalEta")}
                    value={eta !== null ? duration(eta) : t("waitingMovement")}
                  />
                  <Metric
                    label={t("arrival")}
                    value={
                      eta !== null
                        ? new Date(Date.now() + eta * 1000).toLocaleTimeString(
                            language === "en" ? "en-US" : "es-PE",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : "—"
                    }
                  />
                </>
              )}
            </div>
          )}
          {mode === "vehicle" && onNavigation && (
            <div className="notice">
              {traffic &&
              Date.now() - Date.parse(traffic.updatedAt) <= 300000 ? (
                <div>
                  {t("trafficEta")}: {duration(traffic.etaSeconds)}
                  {traffic.condition && (
                    <p>
                      {t(
                        traffic.condition === "flow"
                          ? "trafficFlow"
                          : traffic.condition === "moderate"
                            ? "trafficModerate"
                            : "trafficCongested",
                      )}
                    </p>
                  )}
                  {traffic.incidents?.map((x, i) => (
                    <p key={i}>{x}</p>
                  ))}
                </div>
              ) : (
                t("trafficUnavailable")
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
