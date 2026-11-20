/**
 * The sample swimruns of the extractor page, as courses with variants (software guidebook, section 6.6).
 * A variant is one way of doing a course: race day or training, high or low water, or a route that keeps
 * clear of nesting birds. Each variant has a description and its own typical GPX file.
 * A variant without a file is announced on the page but cannot be loaded yet.
 * Exactly one variant of a course is the canonical one, the main way of doing the course; it always has a file.
 */
export interface SampleVariant {
  id: string;
  label: string;
  description: string;
  /** The main variant of the course; exactly one per course. */
  canonical: boolean;
  /** File name on the site under samples/; null while the typical GPX for this variant is missing. */
  file: string | null;
  /** File name in test-data/ that is copied to `file` by `npm run build:samples`. */
  source: string | null;
}

export interface SampleCourse {
  id: string;
  name: string;
  variants: SampleVariant[];
}

export const SAMPLE_COURSES: readonly SampleCourse[] = [
  {
    id: "rhederlaag",
    name: "Rhederlaag SwimRun",
    variants: [
      {
        id: "recorded-2025-10-11",
        label: "As recorded, 11 October 2025",
        description: "The loop as one athlete swam and ran it. The water level that day is not noted yet.",
        // TODO(#80): note the water level of this day, and confirm that this is the canonical variant.
        canonical: true,
        file: "rhederlaag-swimrun.gpx",
        source: "rhederlaag-swimrun.gpx",
      },
      {
        id: "high-water",
        label: "High water",
        description: "The loop when the water is high. What changes in the route is still to be described.",
        // TODO(#80): add the typical GPX and describe what changes in the route.
        canonical: false,
        file: null,
        source: null,
      },
      {
        id: "low-water",
        label: "Low water",
        description: "The loop when the water is low. What changes in the route is still to be described.",
        // TODO(#80): add the typical GPX and describe what changes in the route.
        canonical: false,
        file: null,
        source: null,
      },
      {
        id: "bird-breeding-season",
        label: "Water bird breeding season",
        description: "From April to June some islands are avoided for the sake of nature.",
        // TODO(#80): add the typical GPX and name the islands that are avoided.
        canonical: false,
        file: null,
        source: null,
      },
    ],
  },
  {
    id: "rondje-eilanden",
    name: "Het Rondje Eilanden",
    variants: [
      {
        id: "race-day",
        label: "Race day",
        description:
          "The race starts with swim A of about 400 m along the island, because the whole island is full of people on race day. Recorded on 19 July 2025.",
        canonical: true,
        file: "rondje-eilanden.gpx",
        source: "Rondje_Eilanden_2025.gpx",
      },
      {
        id: "lintjes-opruimen",
        label: "Lintjes opruimen",
        description: "Clearing the ribbons after the event, recorded on 19 July 2026. The recording is missing the part from island 3 to 5.",
        canonical: false,
        file: "rondje-eilanden-lintjes-opruimen.gpx",
        source: "Rondje_Eilanden_lintjes_opruimen.gpx",
      },
      {
        id: "training",
        label: "Training",
        description: "When training, the first stretch (swim A) is run instead of swum.",
        // TODO(#80): add the typical GPX of this variant.
        canonical: false,
        file: null,
        source: null,
      },
    ],
  },
  {
    id: "twiske-backyard",
    name: "Twiske Backyard SwimRun",
    variants: [{
      id: "standard",
      label: "Standard",
      description: "The Twiske Backyard Ultra SwimRun Experience of 20 June 2026: three laps, the Experience variant. Work in progress: the total distance is not correct yet, and the same part of the course is sometimes found as a swim on one lap and as a run on another.",
      canonical: true,
      file: "twiske-backyard.gpx",
      source: "Twiske_Backyard_SwimRun_Experience.gpx",
    }],
  },
  {
    id: "ruegen",
    name: "Ötillö Rügen",
    variants: [{
      id: "recorded-2026-05-16",
      label: "As recorded, 16 May 2026",
      description: "The Ötillö Rügen SwimRun World Series, recorded on 16 May 2026.",
      canonical: true,
      file: "ruegen-swimrun.gpx",
      source: "Ötillö_Rügen_met_Sander_SwimRun_World_Serious_.gpx",
    }],
  },
  {
    id: "cannes",
    name: "Ötillö Cannes",
    variants: [{
      id: "standard",
      label: "Standard",
      description: "The Ötillö Cannes World Series of 3 October 2026.",
      canonical: true,
      file: "frankrijk-swimrun.gpx",
      source: "Frankrijk_SwimRun_Coros.gpx",
    }],
  },
];

/** The variants that have a GPX file, as pairs of source (test-data) and site file name. */
export function sampleFiles(courses: readonly SampleCourse[] = SAMPLE_COURSES): [source: string, file: string][] {
  return courses.flatMap((course) =>
    course.variants.flatMap((variant): [string, string][] =>
      variant.file !== null && variant.source !== null ? [[variant.source, variant.file]] : []
    )
  );
}
