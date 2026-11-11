import { haversineDistance } from "../distance-calculator.ts";
import { assertInstant, DomainError, type Instant } from "./kernel.ts";

/** A position on a course: no time and no sensor data. */
export interface LinePoint {
  readonly lat: number;
  readonly lon: number;
  readonly elevation: number | null;
}

/** A position of a recording: with the time it was recorded and, when the device had it, the heart rate. */
export interface TracePoint extends LinePoint {
  readonly time: Instant;
  readonly heartRate: number | null;
}

function checkPosition(point: LinePoint, index: number): void {
  const { lat, lon, elevation } = point;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new DomainError(`Point ${index}: latitude must be -90 to 90`);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new DomainError(`Point ${index}: longitude must be -180 to 180`);
  if (elevation !== null && !Number.isFinite(elevation)) throw new DomainError(`Point ${index}: elevation must be a number or null`);
}

/** The distance in metres along the points from index `from` to index `to`, inclusive. */
export function distanceAlongM(points: readonly LinePoint[], from = 0, to = points.length - 1): number {
  let metres = 0;
  for (let i = from + 1; i <= to; i++) metres += haversineDistance(points[i - 1], points[i]) * 1000;
  return metres;
}

/** The ideal line of a course: positions only. Immutable. */
export class CourseLine {
  readonly points: readonly LinePoint[];

  constructor(points: readonly LinePoint[]) {
    if (points.length < 2) throw new DomainError("A line needs at least two points");
    points.forEach(checkPosition);
    this.points = Object.freeze(points.map(({ lat, lon, elevation }) => Object.freeze({ lat, lon, elevation })));
    Object.freeze(this);
  }

  lengthM(): number {
    return distanceAlongM(this.points);
  }

  distanceBetweenM(startIndex: number, endIndex: number): number {
    return distanceAlongM(this.points, startIndex, endIndex);
  }
}

/** What an athlete recorded: positions with time, in the order they were recorded. Immutable. */
export class Trace {
  readonly points: readonly TracePoint[];

  constructor(points: readonly TracePoint[]) {
    if (points.length < 2) throw new DomainError("A trace needs at least two points");
    let previous = -Infinity;
    points.forEach((point, index) => {
      checkPosition(point, index);
      const time = Date.parse(assertInstant(point.time, `Point ${index}: time`));
      if (time < previous) throw new DomainError(`Point ${index}: time must not go back`);
      previous = time;
      if (point.heartRate !== null && (!Number.isFinite(point.heartRate) || point.heartRate <= 0)) {
        throw new DomainError(`Point ${index}: heart rate must be a positive number or null`);
      }
    });
    this.points = Object.freeze(points.map((point) => Object.freeze({ ...point })));
    Object.freeze(this);
  }

  durationS(): number {
    return (Date.parse(this.points[this.points.length - 1].time) - Date.parse(this.points[0].time)) / 1000;
  }

  distanceM(): number {
    return distanceAlongM(this.points);
  }

  /** Distance in metres from the first point to every point. */
  cumulativeM(): number[] {
    const cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      cumulative.push(cumulative[i - 1] + haversineDistance(this.points[i - 1], this.points[i]) * 1000);
    }
    return cumulative;
  }
}
