# 6. Open-Source GIS Stack (No ArcGIS, No QGIS as Runtime Dependency)

Date: 2026-06-15

## 1. Status

Accepted

## 2. Context

The GPX Swimrun Analyzer needs geographic capabilities:

- Determine if a coordinate is in a body of water or on land
- Classify road/path surface type (asphalt, trail, gravel)
- Calculate distances along a track
- Render an interactive map
- Potentially label segments with place names

Commercial GIS platforms (ArcGIS by Esri, Google Maps Platform) and
desktop GIS tools (QGIS) exist, but we need to assess whether they
are necessary or whether open-source alternatives suffice.

## 3. Options

### 3.1 Option A: Fully open-source stack (chosen)

| Capability | Solution | License | Cost |
|-----------|----------|---------|------|
| Terrain data (water/land) | OpenStreetMap via Overpass API | ODbL | Free (public API) |
| Point-in-polygon tests | Custom TypeScript or Turf.js | MIT | Free |
| Distance calculation | Custom Haversine (TypeScript) | — | Free |
| Map rendering | Leaflet + OSM tiles | BSD-2 | Free |
| Geocoding/labeling | Komoot Photon (optional) | Apache-2.0 | Free |
| Road/path classification | OSM highway tags via Overpass | ODbL | Free |

### 3.2 Option B: ArcGIS (Esri)

#### Pros

- Comprehensive spatial analysis platform
- High-quality basemaps and geocoding
- Enterprise support

#### Cons

- Licensing cost: €2,000–10,000+/year depending on tier
- Vendor lock-in to Esri ecosystem
- Overkill for point-in-polygon + distance calculations
- Not feasible for an open-source startup project

### 3.3 Option C: Google Maps Platform

#### Pros

- Familiar API, good documentation
- Reliable infrastructure

#### Cons

- Per-request pricing adds up quickly with terrain queries
- No "is this point in water?" API endpoint (would need workarounds)
- Not open-source; creates dependency on Google
- GDPR concerns with data flowing through US infrastructure

### 3.4 Option D: QGIS as runtime dependency

QGIS is a powerful open-source desktop GIS, but it is an interactive
application, not a server-side library.

#### Pros

- Free and open-source
- Extensive spatial analysis capabilities

#### Cons

- Desktop application, not a web service or library
- Cannot be embedded in a Deno backend or browser
- Requires manual operation — cannot automate for end users

## 4. Decision

**Option A: Fully open-source stack.**

All GIS capabilities are provided by open-source tools and data:

1. **OpenStreetMap + Overpass API** for terrain data (water polygons,
   road/path features). This is our primary spatial data source.
2. **Custom TypeScript** for point-in-polygon (ray casting algorithm)
   and Haversine distance. Alternatively, Turf.js (`@turf/boolean-point-in-polygon`)
   which is MIT-licensed and works in Deno.
3. **Leaflet** for interactive map rendering with OSM tile layers.
4. **Komoot Photon** (optional, future) for reverse geocoding to label
   segments with human-readable place names (e.g. "Lac de Laffrey").

No commercial GIS software is needed. ArcGIS is explicitly excluded
due to cost. QGIS may be used as a development/debugging tool to
visually inspect water polygons, but is not a runtime dependency.

## 5. Komoot Ecosystem Assessment

Komoot has 53 public repositories on GitHub, but their core routing
and outdoor navigation engine is proprietary. The relevant open-source
project is:

- **Photon** (github.com/komoot/photon) — An open-source geocoder for
  OSM data, built on Elasticsearch. It provides forward and reverse
  geocoding (address/place name search), not terrain classification.
  The public instance runs at photon.komoot.io.

**Relevance to our project:**

- Photon does NOT answer "is this coordinate in water?" — it answers
  "what place name is near this coordinate?"
- It could be used to label segments with place names (future feature)
- It is NOT needed for core terrain detection — that's Overpass API
- Our architecture already references Komoot as a potential API target;
  in practice this means Photon for geocoding only, not for terrain

**Conclusion:** OSM via Overpass is our terrain source. Komoot/Photon
is an optional future addition for place-name labeling only.

## 6. Consequences

- No commercial GIS licensing costs
- All spatial data comes from OpenStreetMap (ODbL license — requires
  attribution: "© OpenStreetMap contributors")
- Point-in-polygon is implemented in TypeScript (or via Turf.js)
- QGIS may be used during development for visual debugging but is not
  part of the build, deploy, or runtime pipeline
- The Komoot reference in the architecture diagram refers to Photon
  (geocoding) specifically, not to terrain detection
- If Photon is added later, it can be self-hosted (Java + Elasticsearch)
  or accessed via the free public API at photon.komoot.io

## References

- Esri. (n.d.). *ArcGIS pricing*. https://www.esri.com/en-us/arcgis/products/arcgis-online/pricing
- QGIS Development Team. (n.d.). *QGIS: A free and open source geographic information system*. https://qgis.org/
- Komoot. (n.d.). *Photon: An open source geocoder for OpenStreetMap data* [Source code]. https://github.com/komoot/photon
- Turf.js. (n.d.). *Advanced geospatial analysis for browsers and Node.js*. https://turfjs.org/
