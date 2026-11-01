import type { ActivityType } from "../types";

// Inline SVG keeps markers available offline without a font or image request.
const paths: Record<ActivityType | "destination", string[]> = {
  walk: [
    "M14 4a2 2 0 1 0 0 .01",
    "m12 8-3 5H5m7-5 3 5 4 1M12 8l-1 7-4 7m4-7 5 2 1 5",
  ],
  run: [
    "M15 3a2 2 0 1 0 0 .01",
    "m13 7-4 3-4-1m8-2 3 5 4-1M13 7l-3 8-6 2m6-2 6 2-2 5",
  ],
  bike: [
    "M6 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8M18 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "m6 18 4-9 8 9H6l7-7m2-6h3l2 8M8 9h4",
  ],
  vehicle: [
    "m5 10 2-6h10l2 6M5 10h14v9H5zM8 14h.01M16 14h.01M7 19v2m10-2v2",
    "M8 7h8",
  ],
  destination: ["M5 22V3m0 1c5-5 9 5 15 0v10c-6 5-10-5-15 0"],
};
export function markerElement(
  mode: ActivityType | "destination",
  label: string,
) {
  const element = document.createElement("div");
  element.className = `activity-marker marker-${mode}`;
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of paths[mode]) {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  element.append(svg);
  return element;
}
