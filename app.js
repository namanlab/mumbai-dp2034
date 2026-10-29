/* Mumbai DP 2034 Explorer: MapLibre GL + PMTiles */
"use strict";

const pmtilesProtocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile);
const HERE = new URL(".", location.href).href;

/* ------------------------------------------------------------------ colours */
const ZONES = {
  "R": ["Residential", "#F5E3A1"],
  "C": ["Commercial", "#F2A98F"],
  "I": ["Industrial", "#C7A6D8"],
  "NA": ["Natural area", "#BFE3B4"],
  "NDZ": ["No-development zone", "#DCEBC2"],
  "SDZ": ["Special development zone", "#F6D39C"],
  "NDZ/SDZ (Slum)": ["Slum (NDZ/SDZ)", "#E7CC9A"],
  "G-Z": ["Green zone", "#A9D98F"],
};
const AMENITY = {
  os: ["Open spaces & gardens", "#4FAE6A"],
  edu: ["Education", "#3D7FD9"],
  health: ["Health", "#D9534F"],
  social: ["Social amenities & markets", "#8E6CC7"],
  municipal: ["Municipal services", "#A87B4F"],
  utility: ["Public utilities & police", "#2A9D8F"],
  transport: ["Transport & parking", "#5B7896"],
  housing: ["Housing & rehabilitation", "#E39B3A"],
  offices: ["Government offices", "#C46FA0"],
  fishing: ["Fisheries & dhobi ghats", "#3FA7C9"],
  plot: ["Amenity plots", "#B5A642"],
  other: ["Other", "#8D8D8D"],
};
// DP 2034 amenity codes: R* = reservation (proposed), E* = designation (existing)
const MAINTYPE_GROUP = {
  ROS: "os", EOS: "os", L_RG: "os",
  RE: "edu", EE: "edu",
  RH: "health", EH: "health",
  RSA: "social", ESA: "social",
  RMS: "municipal", EMS: "municipal",
  RPU: "utility", EPU: "utility",
  RT: "transport", ET: "transport", Metro: "transport",
  RR: "housing", ER: "housing",
  RO: "offices", EO: "offices",
  RP: "fishing", EP: "fishing",
  RAM: "plot", EAM: "plot",
};
const CRZ = {
  "CRZ IA": "#7FB89A", "CRZ IA mangrove buffer (50 m)": "#B2D69F", "CRZ IB": "#9FCBBE",
  "CRZ II": "#F0C878", "CRZ III no-development zone": "#C3B3E0", "NDZ within CRZ II": "#D5C7EC",
  "CRZ IVB": "#8DB5DA", "CRZ IIIB (200-500 m from HTL)": "#E3B48C",
};
const METRO = {
  "Metro Line 1": "#2C6FD1", "Metro Line 2A": "#E3B505", "Metro Line 2B": "#D9A400",
  "Metro Line 3": "#00A0B0", "Metro Line 4": "#3BA55C", "Metro Line 6": "#E05BA3",
  "Metro Line 7": "#D7263D", "Metro Line 7A": "#B81D33", "Metro Line 8": "#B8860B",
  "Metro Line 9": "#C0392B", "Metro Car Depot": "#8D8D8D",
};

const match = (field, table, fallback) =>
  ["match", ["get", field], ...Object.entries(table).flat(), fallback];
const groupExpr = match("maintype", MAINTYPE_GROUP, "other");
const amenityColour = ["match", groupExpr, ...Object.entries(AMENITY).map(([k, v]) => [k, v[1]]).flat(), "#8D8D8D"];
const zoneColour = match("zone", Object.fromEntries(Object.entries(ZONES).map(([k, v]) => [k, v[1]])), "#E4E4E4");
const amenityGroupOf = p => MAINTYPE_GROUP[p.maintype] || "other";

/* ------------------------------------------------------------------ layers */
// Drawn bottom to top. `op` is a fill's own opacity, scaled by the global slider.
const LAYERS = [
  { id: "zones", src: "base", group: "Plan", label: "Land-use zones", type: "fill", on: true, op: 0.62,
    sw: "#F5E3A1", paint: { "fill-color": zoneColour, "fill-outline-color": "rgba(90,90,90,.35)" } },
  { id: "crz", src: "crz", group: "Coast & water", label: "CRZ coastal zones", type: "fill", on: false, op: 0.5,
    sw: "#7FB89A", paint: { "fill-color": match("crz_class", CRZ, "#A9C6D6"), "fill-outline-color": "rgba(30,90,110,.45)" } },
  { id: "water", src: "base", group: "Coast & water", label: "Water bodies", type: "fill", on: true, op: 0.85,
    sw: "#A6CCE8", paint: { "fill-color": "#A6CCE8", "fill-outline-color": "#5E97CC" } },
  { id: "designations", src: "base", group: "Plan", label: "Designations", hint: "existing amenities", type: "fill",
    on: false, op: 0.9, sw: "#8E6CC7", hatch: true,
    paint: { "fill-pattern": ["concat", "hatch-", groupExpr] } },
  { id: "reservations", src: "base", group: "Plan", label: "Reservations", hint: "proposed amenities", type: "fill",
    on: true, op: 0.62, sw: "#4FAE6A", paint: { "fill-color": amenityColour, "fill-outline-color": "rgba(30,30,30,.45)" } },
  { id: "existing_roads", src: "base", group: "Roads", label: "Existing roads", type: "fill", on: true, op: 0.9,
    sw: "#B4BAC3", paint: { "fill-color": "#B4BAC3", "fill-outline-color": "#8B929C" } },
  { id: "proposed_roads", src: "base", group: "Roads", label: "Proposed roads & widening", type: "fill", on: true, op: 0.88,
    sw: "#E8743B", paint: { "fill-color": "#E8743B", "fill-outline-color": "#B4531F" } },
  { id: "heritage", src: "base", group: "Heritage", label: "Heritage sites", type: "fill", on: false, op: 0.55,
    sw: "#C79A5B", paint: { "fill-color": "#C79A5B", "fill-outline-color": "#7A5A22" } },
  { id: "amenities", src: "base", group: "Plan", label: "Amenity sites", hint: "acquisition status", type: "line",
    on: false, sw: "#D6336C", ln: true,
    paint: { "line-color": "#D6336C", "line-width": 2, "line-dasharray": [2, 1.5] } },
  { id: "parcels", src: "parcels", group: "Cadastre", label: "Property parcels", hint: "from zoom 14", type: "line",
    on: true, sw: "#6E5B45", ln: true, minzoom: 14,
    paint: { "line-color": "#6E5B45",
             "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.35, 16, 0.8, 18, 1.5],
             "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.45, 16, 0.85] } },
  { id: "village_boundary", src: "base", group: "Boundaries", label: "Village boundaries", type: "line", on: false,
    sw: "#9B6DC9", ln: true, paint: { "line-color": "#9B6DC9", "line-width": 1.3, "line-dasharray": [3, 2] } },
  { id: "ward_boundary", src: "base", group: "Boundaries", label: "Ward boundaries", type: "line", on: true,
    sw: "#2F3B48", ln: true,
    paint: { "line-color": "#2F3B48", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.1, 14, 2.8] } },
  { id: "railway", src: "base", group: "Transport", label: "Suburban railway", type: "line", on: false,
    sw: "#4A4A4A", ln: true, paint: { "line-color": "#4A4A4A", "line-width": 2.2, "line-dasharray": [3, 2] } },
  { id: "mono", src: "base", group: "Transport", label: "Monorail", type: "line", on: false,
    sw: "#16A085", ln: true, paint: { "line-color": "#16A085", "line-width": 2.6 } },
  { id: "metro", src: "base", group: "Transport", label: "Metro lines", type: "line", on: false,
    sw: "#00A0B0", ln: true, paint: { "line-color": match("line", METRO, "#7B4FC9"), "line-width": 3.2 } },
  { id: "railway_stations", src: "base", group: "Transport", label: "Railway stations", type: "circle", on: false,
    sw: "#4A4A4A", pt: true,
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 5], "circle-color": "#fff",
             "circle-stroke-color": "#4A4A4A", "circle-stroke-width": 2 } },
  { id: "metro_stations", src: "base", group: "Transport", label: "Metro stations", type: "circle", on: false,
    sw: "#00A0B0", pt: true,
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 5], "circle-color": "#fff",
             "circle-stroke-color": "#00A0B0", "circle-stroke-width": 2 } },
];
const GROUPS = ["Plan", "Roads", "Cadastre", "Coast & water", "Boundaries", "Transport", "Heritage"];
const L = id => LAYERS.find(l => l.id === id);

// Polygon datasets that can be identified by clicking, in report order.
const REPORT_ORDER = ["parcels", "amenities", "reservations", "designations", "proposed_roads", "existing_roads",
                      "zones", "crz", "heritage", "water", "village_boundary", "ward_boundary"];
// Compact features that get the hover/selection outline when several overlap (top first).
// Large context polygons (zones, CRZ, the road network) are reported but not outlined.
const PICK_ORDER = ["parcels", "amenities", "reservations", "designations", "proposed_roads", "heritage", "water"];
const srcOf = id => (id === "parcels" || id === "crz" ? id : "base");

/* ------------------------------------------------------------------ report fields */
const fmtArea = v => {
  const n = Number(v);
  return isFinite(n) ? `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} m² · ${(n * 10.7639).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ft²` : v;
};
const REPORT = {
  parcels: { title: "Property parcel", colour: "#6E5B45",
    fields: [["cts", "CTS / CS no."], ["old_cts", "Old CTS no."], ["village", "Village"], ["ward", "Ward"],
             ["area", "Area", fmtArea], ["type", "Type"], ["tps", "TP scheme"], ["fp_no", "Final plot"],
             ["plot_no", "Plot no."], ["remarks", "DP remarks"], ["remark2", "Remark"], ["mod_no", "Modification"],
             ["pc_rec", "PC recommendation"]] },
  amenities: { title: "Amenity site", colour: "#D6336C",
    fields: [["reservation", "Reservation"], ["description", "Purpose"], ["status", "Site status"],
             ["acquisition", "Mode of acquisition"], ["department", "User department"], ["cts", "CTS no."],
             ["area", "Area", fmtArea]] },
  reservations: { title: "Reservation", colour: p => AMENITY[amenityGroupOf(p)][1], sub: p => AMENITY[amenityGroupOf(p)][0],
    fields: [["label", "Code"], ["description", "Purpose"], ["remark", "Remark"], ["mod_no", "Modification"]] },
  designations: { title: "Designation", colour: p => AMENITY[amenityGroupOf(p)][1], sub: p => AMENITY[amenityGroupOf(p)][0],
    fields: [["label", "Code"], ["description", "Existing use"], ["remark", "Remark"], ["mod_no", "Modification"]] },
  proposed_roads: { title: "Proposed road / widening", colour: "#E8743B",
    fields: [["width", "Width", v => `${v} m`], ["road_type", "Type", v => ({ PR: "Proposed road", PRW: "Road widening", "*PRW": "Road widening" }[v] || v)],
             ["remarks", "Remarks"]] },
  existing_roads: { title: "Existing road", colour: "#8B929C", fields: [["type", "Type", v => String(v).replace("Exisiting", "Existing")]] },
  zones: { title: "Land-use zone", colour: p => (ZONES[p.zone] || [0, "#ccc"])[1],
    fields: [["zone", "Zone", v => ZONES[v] ? `${ZONES[v][0]} (${v})` : v], ["suburb", "Area"], ["ep_no", "EP no."]] },
  crz: { title: "Coastal regulation zone", colour: p => CRZ[p.crz_class] || "#A9C6D6",
    fields: [["crz_class", "Category"], ["class", "Class"]] },
  heritage: { title: "Heritage site", colour: "#C79A5B",
    fields: [["name", "Name"], ["grade", "Grade"], ["precinct", "Precinct"], ["uses", "Use"], ["ownership", "Ownership"]] },
  water: { title: "Water body", colour: "#5E97CC", fields: [] },
  village_boundary: { title: "Village", colour: "#9B6DC9", fields: [["village", "Village"]] },
  ward_boundary: { title: "Ward", colour: "#2F3B48", fields: [["ward", "Ward"]] },
};

/* ------------------------------------------------------------------ basemaps */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const BASEMAPS = {          // key -> raster layers shown
  light: { name: "Light", layers: ["bm-light", "bm-ref"] },
  streets: { name: "Streets", layers: ["bm-streets"] },
  satellite: { name: "Satellite", layers: ["bm-sat"] },
  none: { name: "Plain", layers: [] },
};
const BM_LAYERS = ["bm-light", "bm-ref", "bm-streets", "bm-sat"];

/* ------------------------------------------------------------------ style */
let opacity = 0.85;
function buildStyle() {
  const layers = [
    { id: "bg", type: "background", paint: { "background-color": "#eef1f5" } },
    { id: "bm-light", type: "raster", source: "bm-light" },
    { id: "bm-streets", type: "raster", source: "bm-streets", layout: { visibility: "none" } },
    { id: "bm-sat", type: "raster", source: "bm-sat", layout: { visibility: "none" } },
  ];
  for (const d of LAYERS) {
    const paint = { ...d.paint };
    if (d.type === "fill") paint["fill-opacity"] = d.op * opacity;
    const lyr = { id: d.id, type: d.type, source: d.src, "source-layer": d.id, paint,
                  layout: { visibility: d.on ? "visible" : "none" } };
    if (d.minzoom) lyr.minzoom = d.minzoom;
    layers.push(lyr);
  }
  // basemap place labels sit above the plan colours
  layers.push({ id: "bm-ref", type: "raster", source: "bm-ref", maxzoom: 16.6,
    paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 15.8, 0.9, 16.5, 0] } });
  // invisible, always-on polygons used to identify what lies under a click
  for (const id of REPORT_ORDER) {
    layers.push({ id: `q-${id}`, type: "fill", source: srcOf(id), "source-layer": id,
                  paint: { "fill-color": "rgba(0,0,0,0)" }, ...(id === "parcels" ? { minzoom: 14 } : {}) });
  }
  // hover / selection outlines driven by feature state
  for (const id of PICK_ORDER) {
    layers.push({ id: `hl-${id}`, type: "line", source: srcOf(id), "source-layer": id,
      paint: { "line-color": "#FF2D55",
               "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3.2, 2.2],
               "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1,
                                ["boolean", ["feature-state", "hover"], false], 0.85, 0] } });
  }
  layers.push({ id: "sel-fill", type: "fill", source: "parcels", "source-layer": "parcels", minzoom: 14,
    paint: { "fill-color": "#FF2D55",
             "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.16, 0] } });
  // labels
  const halo = { "text-halo-color": "rgba(255,255,255,.95)", "text-halo-width": 1.6 };
  layers.push(
    { id: "ward-labels", type: "symbol", source: "base", "source-layer": "ward_labels", minzoom: 10,
      layout: { "text-field": ["get", "ward"], "text-font": ["Open Sans Bold"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 10, 12, 15, 17], "text-allow-overlap": false },
      paint: { "text-color": "#2F3B48", ...halo } },
    { id: "village-labels", type: "symbol", source: "base", "source-layer": "village_labels", minzoom: 13,
      layout: { "text-field": ["get", "village"], "text-font": ["Open Sans Italic"], "text-size": 12,
                visibility: L("village_boundary").on ? "visible" : "none" },
      paint: { "text-color": "#7B4FA8", ...halo } },
    { id: "station-labels", type: "symbol", source: "base", "source-layer": "railway_stations", minzoom: 13,
      layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Regular"], "text-size": 11,
                "text-offset": [0, 1.1], "text-anchor": "top", visibility: "none" },
      paint: { "text-color": "#333", ...halo } },
    { id: "metro-labels", type: "symbol", source: "base", "source-layer": "metro_stations", minzoom: 13.5,
      layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Regular"], "text-size": 10.5,
                "text-offset": [0, 1.1], "text-anchor": "top", visibility: "none" },
      paint: { "text-color": "#00747F", ...halo } },
    { id: "metro-line-labels", type: "symbol", source: "base", "source-layer": "metro", minzoom: 12,
      layout: { "symbol-placement": "line", "text-field": ["get", "line"], "text-font": ["Open Sans Bold"],
                "text-size": 11, "symbol-spacing": 400, visibility: "none" },
      paint: { "text-color": match("line", METRO, "#7B4FC9"), ...halo } },
    { id: "parcel-labels", type: "symbol", source: "parcels", "source-layer": "parcels", minzoom: 17,
      layout: { "text-field": ["get", "cts"], "text-font": ["Open Sans Regular"], "text-size": 10.5 },
      paint: { "text-color": "#4A3F33", ...halo } },
  );
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      base: { type: "vector", url: `pmtiles://${HERE}tiles/base.pmtiles` },
      parcels: { type: "vector", url: `pmtiles://${HERE}tiles/parcels.pmtiles` },
      crz: { type: "vector", url: `pmtiles://${HERE}tiles/crz.pmtiles` },
      "bm-light": { type: "raster", tileSize: 256, maxzoom: 16, attribution: "Basemap © Esri and data providers",
        tiles: [`${ESRI}Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`] },
      "bm-ref": { type: "raster", tileSize: 256, maxzoom: 16,
        tiles: [`${ESRI}Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`] },
      "bm-streets": { type: "raster", tileSize: 256, maxzoom: 19, attribution: "Basemap © Esri and data providers",
        tiles: [`${ESRI}World_Street_Map/MapServer/tile/{z}/{y}/{x}`] },
      "bm-sat": { type: "raster", tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri and data providers",
        tiles: [`${ESRI}World_Imagery/MapServer/tile/{z}/{y}/{x}`] },
    },
    layers,
  };
}
const LABELS_FOR = { village_boundary: ["village-labels"], railway_stations: ["station-labels"],
                     metro_stations: ["metro-labels"], metro: ["metro-line-labels"], ward_boundary: ["ward-labels"], parcels: ["parcel-labels"] };

/* ------------------------------------------------------------------ map */
const map = new maplibregl.Map({
  container: "map",
  style: buildStyle(),
  bounds: [[72.776, 18.894], [72.981, 19.270]],
  fitBoundsOptions: { padding: window.innerWidth >= 860 ? { top: 70, bottom: 20, left: 320, right: 20 } : 20 },
  minZoom: 9, maxZoom: 19, hash: "map", attributionControl: false,
});
window.dpmap = map;   // handy for the browser console
map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), "bottom-left");
map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// diagonal hatch patterns for designations, generated on demand
map.on("styleimagemissing", e => {
  if (!e.id.startsWith("hatch-")) return;
  const colour = (AMENITY[e.id.slice(6)] || AMENITY.other)[1];
  const s = 12, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = colour + "33"; g.fillRect(0, 0, s, s);
  g.strokeStyle = colour; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-2, s + 2); g.lineTo(s + 2, -2); g.moveTo(-2, 2); g.lineTo(2, -2);
  g.moveTo(s - 2, s + 2); g.lineTo(s + 2, s - 2); g.stroke();
  map.addImage(e.id, g.getImageData(0, 0, s, s));
});

map.on("load", updateStatus);
map.on("move", updateStatus);
map.on("error", e => console.warn("map:", e?.error?.message || e));

function updateStatus() {
  const c = map.getCenter(), z = map.getZoom();
  const hint = L("parcels").on && z < 14 ? " · zoom in to see parcels" : "";
  document.getElementById("status").textContent = `${c.lat.toFixed(5)}° N, ${c.lng.toFixed(5)}° E · z${z.toFixed(1)}${hint}`;
}

/* ------------------------------------------------------------------ panel */
const panel = document.getElementById("panel");
// panel-closed is set before first paint on narrow windows (inline script in index.html)
const setPanel = open => document.documentElement.classList.toggle("panel-closed", !open);
document.getElementById("panelToggle").onclick = () =>
  setPanel(document.documentElement.classList.contains("panel-closed"));

function swatch(d) {
  if (d.pt) return `<span class="sw pt" style="border-color:${d.sw}"></span>`;
  if (d.ln) return `<span class="sw ln" style="background:${d.sw}"></span>`;
  if (d.hatch) return `<span class="sw" style="background:repeating-linear-gradient(-45deg,${d.sw} 0 2px,#fff 2px 5px)"></span>`;
  return `<span class="sw" style="background:${d.sw}"></span>`;
}
function buildPanel() {
  const host = document.getElementById("layerGroups");
  host.innerHTML = "";
  for (const g of GROUPS) {
    const items = LAYERS.filter(d => d.group === g);
    const box = document.createElement("div");
    box.className = "group";
    box.innerHTML = `<p>${g}</p>`;
    for (const d of items) {
      const row = document.createElement("label");
      row.className = "lrow";
      row.innerHTML = `<input type="checkbox" data-id="${d.id}" ${d.on ? "checked" : ""}>${swatch(d)}` +
        `<span class="nm">${d.label}${d.hint ? ` <small>${d.hint}</small>` : ""}</span><span class="tg"></span>`;
      row.querySelector("input").onchange = e => setLayer(d.id, e.target.checked);
      box.appendChild(row);
    }
    host.appendChild(box);
  }
}
function setLayer(id, on) {
  L(id).on = on;
  const box = panel.querySelector(`input[data-id="${id}"]`);
  if (box) box.checked = on;
  const vis = on ? "visible" : "none";
  map.setLayoutProperty(id, "visibility", vis);
  for (const lab of LABELS_FOR[id] || []) map.setLayoutProperty(lab, "visibility", vis);
  if (PICK_ORDER.includes(id)) map.setLayoutProperty(`hl-${id}`, "visibility", vis);
  updateStatus();
}

function buildLegend() {
  const row = (bg, label) => `<div class="lg"><span class="sw" style="background:${bg}"></span>${label}</div>`;
  let html = `<div class="lg-title">Land-use zones</div>`;
  for (const [code, [name, c]] of Object.entries(ZONES)) html += row(c, `${name} <small>(${code})</small>`);
  html += `<div class="lg-title">Reservations (solid) &amp; designations (hatched)</div>`;
  for (const [, [name, c]] of Object.entries(AMENITY)) html += row(c, name);
  html += `<div class="lg-title">Other</div>`;
  html += row("#E8743B", "Proposed road / widening") + row("#B4BAC3", "Existing road") +
          row("#A6CCE8", "Water body") + row("#C79A5B", "Heritage site");
  document.getElementById("legend").innerHTML = html;
}

function buildBasemaps() {
  const host = document.getElementById("basemaps");
  for (const [key, bm] of Object.entries(BASEMAPS)) {
    const b = document.createElement("button");
    b.textContent = bm.name;
    b.className = key === "light" ? "on" : "";
    b.onclick = () => {
      host.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      for (const id of BM_LAYERS) map.setLayoutProperty(id, "visibility", bm.layers.includes(id) ? "visible" : "none");
    };
    host.appendChild(b);
  }
}

document.getElementById("opacity").oninput = e => {
  opacity = +e.target.value;
  for (const d of LAYERS) if (d.type === "fill") map.setPaintProperty(d.id, "fill-opacity", d.op * opacity);
};

/* ------------------------------------------------------------------ hover + selection */
let hovered = null, selected = null;
const ref = f => ({ source: f.source, sourceLayer: f.sourceLayer, id: f.id });
function setState(target, key, value) {
  if (target && target.id !== undefined && target.id !== null) map.setFeatureState(target, { [key]: value });
}
function hits(point) {
  const layers = REPORT_ORDER.map(id => `q-${id}`).filter(id => map.getLayer(id));
  return map.queryRenderedFeatures(point, { layers });
}
function pickable(features) {
  // the topmost feature among visible datasets, by PICK_ORDER
  for (const id of PICK_ORDER) {
    if (!L(id).on) continue;
    const f = features.find(x => x.sourceLayer === id);
    if (f) return f;
  }
  return null;
}

let rafPending = false, lastMove = null;
map.on("mousemove", e => {
  lastMove = e.point;
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const f = pickable(hits(lastMove));
    const same = f && hovered && f.id === hovered.id && f.sourceLayer === hovered.sourceLayer;
    if (!same) {
      setState(hovered, "hover", false);
      hovered = f ? ref(f) : null;
      setState(hovered, "hover", true);
    }
    map.getCanvas().style.cursor = f ? "pointer" : "";
  });
});
map.on("mouseout", () => { setState(hovered, "hover", false); hovered = null; });

function select(target) {
  setState(selected, "selected", false);
  selected = target;
  setState(selected, "selected", true);
}

map.on("click", e => {
  const fs = hits(e.point);
  const top = pickable(fs);
  select(top ? ref(top) : null);
  showReport(e.lngLat, fs);
  hideHint();
});

/* ------------------------------------------------------------------ report */
const reportEl = document.getElementById("report");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function card(id, p) {
  const conf = REPORT[id];
  const colour = typeof conf.colour === "function" ? conf.colour(p) : conf.colour;
  const sub = conf.sub ? conf.sub(p) : "";
  let rows = "";
  for (const [k, label, fmt] of conf.fields) {
    let v = p[k];
    if (v === undefined || v === null || v === "") continue;
    if (fmt) v = fmt(v);
    rows += `<div class="kv"><span class="k">${label}</span><span class="v">${esc(v)}</span></div>`;
  }
  return `<div class="card"><div class="card-h" style="border-left-color:${colour}">${conf.title}` +
         `${sub ? `<small>${esc(sub)}</small>` : ""}</div>${rows ? `<div class="card-b">${rows}</div>` : ""}</div>`;
}

function showReport(lngLat, features, forcedParcel) {
  const seen = new Set(), cards = [];
  if (forcedParcel) { cards.push(card("parcels", forcedParcel)); seen.add("parcels"); }
  for (const id of REPORT_ORDER) {
    for (const f of features.filter(x => x.sourceLayer === id)) {
      const key = `${id}:${f.id}`;
      if (seen.has(key) || (id === "parcels" && seen.has("parcels"))) continue;
      seen.add(key);
      if (id === "parcels") seen.add("parcels");
      cards.push(card(id, f.properties));
    }
  }
  if (!seen.has("parcels") && map.getZoom() < 14) {
    cards.unshift(`<div class="empty">Zoom in (14+) to identify the property parcel here.</div>`);
  }
  document.getElementById("reportCoords").textContent =
    `${lngLat.lat.toFixed(6)}° N, ${lngLat.lng.toFixed(6)}° E`;
  document.getElementById("reportBody").innerHTML =
    cards.length ? cards.join("") : `<div class="empty">No plan features here.</div>`;
  reportEl.classList.remove("hidden");
  document.body.classList.add("report-open");
}
function closeReport() {
  reportEl.classList.add("hidden");
  document.body.classList.remove("report-open");
  select(null);
}
document.getElementById("reportClose").onclick = closeReport;

const hintEl = document.getElementById("hint");
function hideHint() { hintEl.style.opacity = 0; setTimeout(() => hintEl.classList.add("hidden"), 400); }
setTimeout(hideHint, 9000);

/* ------------------------------------------------------------------ search */
const input = document.getElementById("searchInput");
const results = document.getElementById("searchResults");
let index = null, keys = null, loading = null, active = -1;

function loadIndex() {
  if (!loading) {
    loading = fetch(HERE + "parcel_index.json").then(r => r.json()).then(j => {
      index = j.rows;                                   // [id, cts, village, ward, lon, lat]
      keys = index.map(r => `${r[1]} ${r[2]} ${r[3]}`.toLowerCase());
    }).catch(() => { results.innerHTML = `<div class="res-msg">Could not load the parcel index.</div>`; });
  }
  return loading;
}
input.addEventListener("focus", () => { loadIndex(); if (input.value.trim().length > 1) runSearch(); });

let timer = null;
input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runSearch, 110); });

async function runSearch() {
  const q = input.value.trim().toLowerCase();
  if (q.length < 2) { results.classList.remove("open"); return; }
  if (!index) {
    results.innerHTML = `<div class="res-msg">Loading 135,000 parcels…</div>`;
    results.classList.add("open");
    await loadIndex();
    if (!index || input.value.trim().toLowerCase() !== q) return;
  }
  const exact = [], starts = [], contains = [];
  for (let i = 0; i < index.length && exact.length + starts.length < 60; i++) {
    const cts = String(index[i][1]).toLowerCase();
    if (cts === q) exact.push(i);
    else if (cts.startsWith(q)) starts.push(i);
    else if (contains.length < 60 && keys[i].includes(q)) contains.push(i);
  }
  const list = exact.concat(starts, contains).slice(0, 30);
  active = -1;
  if (!list.length) {
    results.innerHTML = `<div class="res-msg">No parcels match “${esc(input.value)}”.</div>`;
  } else {
    results.innerHTML = list.map(i => {
      const [id, cts, village, ward] = index[i];
      return `<div class="res" data-i="${i}"><b>CTS ${esc(cts) || "—"}</b><span>${esc(village)} · Ward ${esc(ward)}</span></div>`;
    }).join("");
    results.querySelectorAll(".res").forEach(el => el.onclick = () => pick(+el.dataset.i));
  }
  results.classList.add("open");
}

input.addEventListener("keydown", e => {
  const items = [...results.querySelectorAll(".res")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!items.length) return;
    e.preventDefault();
    active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((el, j) => el.classList.toggle("active", j === active));
    items[active].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && items.length) {
    pick(+items[Math.max(active, 0)].dataset.i);
  } else if (e.key === "Escape") {
    results.classList.remove("open"); input.blur();
  }
});

function pick(i) {
  const [id, cts, village, ward, lon, lat] = index[i];
  results.classList.remove("open");
  input.value = `CTS ${cts}, ${village}`;
  input.blur();
  hideHint();
  if (!L("parcels").on) setLayer("parcels", true);
  map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 17.3), speed: 1.6 });
  map.once("idle", () => {
    const target = { source: "parcels", sourceLayer: "parcels", id };
    select(target);
    const pt = map.project([lon, lat]);
    const parcel = map.querySourceFeatures("parcels", { sourceLayer: "parcels", filter: ["==", ["id"], id] })[0];
    showReport({ lng: lon, lat }, hits(pt).filter(f => f.sourceLayer !== "parcels"),
               parcel ? parcel.properties : { cts, village, ward });
  });
}

document.addEventListener("click", e => { if (!e.target.closest(".search")) results.classList.remove("open"); });
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  if (e.key === "Escape" && document.activeElement !== input) {
    document.getElementById("aboutModal").classList.add("hidden");
    closeReport();
  }
});

/* ------------------------------------------------------------------ stats, wards, about */
async function loadStats() {
  try {
    const s = await (await fetch(HERE + "stats.json")).json();
    const sel = document.getElementById("wardJump");
    for (const w of Object.keys(s.wards)) sel.insertAdjacentHTML("beforeend", `<option value="${esc(w)}">Ward ${esc(w)}</option>`);
    sel.onchange = () => {
      const b = s.wards[sel.value];
      if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60 });
      sel.value = "";
    };
    const c = s.counts, n = v => (v ?? 0).toLocaleString("en-IN");
    document.getElementById("aboutStats").innerHTML =
      `<div class="stats">` +
      [[c.parcels, "property parcels"], [c.reservations, "reservations"], [c.designations, "designations"],
       [c.proposed_roads, "road proposals"], [c.zones, "zone polygons"], [c.heritage, "heritage sites"]]
        .map(([v, l]) => `<div class="stat"><b>${n(v)}</b><span>${l}</span></div>`).join("") +
      `</div><p class="fine">Data downloaded ${esc(s.built)}.` +
      (s.skipped ? ` ${s.skipped} features could not be served by the MCGM server and are missing.` : "") + `</p>`;
  } catch (_) { /* stats are optional */ }
}
const about = document.getElementById("aboutModal");
document.getElementById("aboutBtn").onclick = () => about.classList.remove("hidden");
document.getElementById("aboutClose").onclick = () => about.classList.add("hidden");
about.onclick = e => { if (e.target === about) about.classList.add("hidden"); };

/* ------------------------------------------------------------------ start-up */
buildPanel();
buildLegend();
buildBasemaps();
loadStats();
