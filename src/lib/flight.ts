import { Vector3Like } from "three/src/math/Vector3";

class Point2D {
  constructor(
    public x: number,
    public y: number,
  ) {}
  plus(p: Point2D) {
    return new Point2D(this.x + p.x, this.y + p.y);
  }
  minus(p: Point2D) {
    return new Point2D(this.x - p.x, this.y - p.y);
  }
  mul(s: number) {
    return new Point2D(this.x * s, this.y * s);
  }
  div(s: number) {
    return new Point2D(this.x / s, this.y / s);
  }
  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }
  toString() {
    return `(${this.x}, ${this.y})`;
  }
}

export class Point3D implements Vector3Like {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}

  plus(p: Point3D) {
    return new Point3D(this.x + p.x, this.y + p.y, this.z + p.z);
  }
  minus(p: Point3D) {
    return new Point3D(this.x - p.x, this.y - p.y, this.z - p.z);
  }
  mul(s: number) {
    return new Point3D(this.x * s, this.y * s, this.z * s);
  }
  div(s: number) {
    return new Point3D(this.x / s, this.y / s, this.z / s);
  }
  neg() {
    return new Point3D(-this.x, -this.y, -this.z);
  }
  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }
  distance(p: Point3D) {
    return Math.sqrt(
      (this.x - p.x) ** 2 + (this.y - p.y) ** 2 + (this.z - p.z) ** 2,
    );
  }
  normalize() {
    const l = this.length();
    return new Point3D(this.x / l, this.y / l, this.z / l);
  }
  toString() {
    return `(${this.x}, ${this.y}, ${this.z})`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
export interface Trajectory extends Object {
  position(t: number): Point3D;
  duration: number;
}

export function getTrajectoryReal2(
  before: Point3D,
  after: Point3D,
): Trajectory {
  // add flight duration to each point based on the distance to prev point
  const traj = getTrajectoryReal(before, after) as (Point3D & { t: number })[];
  /*let totalDistance = 0;
  for (let i = 1; i < traj.length; i++) {
    totalDistance += Math.sqrt(
      (traj[i].x - traj[i - 1].x) ** 2 +
        (traj[i].y - traj[i - 1].y) ** 2 +
        (traj[i].z - traj[i - 1].z) ** 2
    );
  }*/
  let totalT = 0;
  // add calculated distance-based flight duration
  for (let i = 0; i < traj.length; i++) {
    const distance =
      i === 0
        ? 0
        : Math.sqrt(
            (traj[i].x - traj[i - 1].x) ** 2 +
              (traj[i].y - traj[i - 1].y) ** 2 +
              (traj[i].z - traj[i - 1].z) ** 2,
          );
    const t =
      distance *
      Math.min(
        3000,
        i === 0 ? 1 / traj[i].z : (1 / traj[i].z + 1 / traj[i - 1].z) / 2,
      );
    totalT += t;
    traj[i].t = t;
  }
  // limit max flight duration
  if (totalT > 2000) {
    for (const p of traj) {
      p.t *= 2000 / totalT;
    }
    totalT = 2000;
  }

  return new TimeInterpolatingTrajectory({
    position(time: number): Point3D {
      let rest = time;
      let curSegment = 1;
      while (true) {
        if (curSegment >= traj.length) {
          return after;
        }

        if (rest <= traj[curSegment].t) {
          break;
        }

        rest -= traj[curSegment].t;
        curSegment++;
      }

      const segment = traj[curSegment];
      const lastSegment = traj[curSegment - 1];
      const progress = rest / segment.t;
      //console.log("return ", {curSegment, progress, rest, time, segment, lastSegment});
      return new Point3D(
        lastSegment.x + (segment.x - lastSegment.x) * progress,
        lastSegment.y + (segment.y - lastSegment.y) * progress,
        lastSegment.z + (segment.z - lastSegment.z) * progress,
      );
    },
    duration: totalT,
    toString() {
      return traj.map((p) => p.toString()).join(" -> ");
    },
  });
}

function getTrajectoryReal(before: Point3D, after: Point3D) {
  const speed = 0.0002;
  const x1 = 0;
  const xScale = 1000;
  const x2 =
    Math.sqrt((after.x - before.x) ** 2 + (after.y - before.y) ** 2) / xScale;
  const y1 = before.z;
  const y2 = after.z;
  const points = getTrajectoryPoints(speed, x1, y1, x2, y2);
  console.log("xy space", {
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
  });
  console.log("trajectory xy", points);
  return points.map((p) => ({
    x: (p.x / x2) * (after.x - before.x) + before.x,
    y: (p.x / x2) * (after.y - before.y) + before.y,
    z: p.y,
  }));
}

function getTrajectoryPoints(
  speed: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const { a, b, c } = calculateTrajectory(x1, y1, x2, y2);
  const points = [];
  for (let x = x1; x <= x2; x += speed) {
    const y = a * x ** 2 + b * x + c;
    points.push({ x, y });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

/** solve ax^2+bx+c based on two x,y pairs plus a set based on the distance between the points */
function calculateTrajectory(x1: number, y1: number, x2: number, y2: number) {
  // Use x-distance for steepness
  const xDistance = Math.abs(x2 - x1);
  // Always make 'a' negative for downward-facing parabola
  const flonk = Math.max(y1, y2);
  // we want aFlonk = -100 when ymax = 1, -1000 when ymax = 0.001
  const a = -xDistance * (1 / flonk) ** 0.3 * 10; // Divided by 5 to make the steepness more manageable
  const b = (y2 - y1 - a * (x2 ** 2 - x1 ** 2)) / (x2 - x1);
  const c = y1 - a * x1 ** 2 - b * x1;
  console.log({ a, b, c });
  return { a, b, c };
}

/**
 * Takes another trajectory and interplolates the time spend on the curve segments depending on the zoom level
 * It also calculates the total duration of the trajectory according to the distance of the whole trajectory
 */
class TimeInterpolatingTrajectory implements Trajectory {
  private points: Point3D[];
  private durations: number[];
  private offsetIndex = 0;
  private offsetTime = 0;
  public duration: number;

  constructor(inner: Trajectory) {
    const points: Point3D[] = [];
    let totalDistance = 0;

    function dist(p1: Point3D, p2: Point3D) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const zScale = 8;
      const dz =
        (Math.log10(1 + (1 / p1.z) * zScale) -
          Math.log10(1 + (1 / p2.z) * zScale)) *
        zScale;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function duration(p: Point3D) {
      const dur = Math.log10(1 + 1 / p.z / 8);
      console.assert(dur >= 0, "duration should be positive");
      return dur;
    }

    function add(
      from: number,
      fromP: Point3D,
      to: number,
      toP: Point3D,
      depth: number,
    ) {
      const distance = dist(fromP, toP);

      const middle = from + (to - from) / 2;
      const middleP = inner.position(middle);
      const eps = 0.0000001;
      const isLineOnZ =
        Math.abs(fromP.z - toP.z) < eps && Math.abs(fromP.z - middleP.z) < eps;

      if (distance <= 2 || isLineOnZ || depth > 400) {
        totalDistance += distance;
        return;
      }

      add(from, fromP, middle, middleP, depth + 1);
      points.push(middleP);
      add(middle, middleP, to, toP, depth + 1);
    }

    const start = 0;
    const startP = inner.position(start);
    const end = inner.duration;
    const endP = inner.position(end);

    //console.log("create TimeInterpolatingTrajectory", { startP, endP, start, end });

    points.push(startP);

    add(start, startP, end, endP, 0);

    points.push(endP);

    //console.log("Points", { length: points.length, totalDistance })

    const maxDuration = 1000;
    const minDuration = 100;
    const targetDuration = totalDistance * 20;
    //console.log("dist-and-dist", { totalDistance, targetDuration });
    this.duration = Math.max(
      minDuration,
      Math.min(targetDuration, maxDuration),
    );

    // create durations
    const durations: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dur = (duration(p1) + duration(p2)) / 2;
      durations.push(dur * dist(p1, p2));
    }

    // normalize durations
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    for (let i = 0; i < durations.length; i++) {
      durations[i] = (durations[i] * this.duration) / totalDuration;
    }

    this.points = points;
    this.durations = durations;
  }

  position(t: number): Point3D {
    while (true) {
      const rest = t - this.offsetTime;
      const p1 = this.points[this.offsetIndex];
      const p2 = this.points[this.offsetIndex + 1];
      const dur = this.durations[this.offsetIndex];

      if (rest < dur) {
        const progress = rest / dur;
        return p1.plus(p2.minus(p1).mul(progress));
      }

      if (this.offsetIndex >= this.points.length - 2) {
        return this.points[this.points.length - 1];
      }

      //console.log("switch to next trajectory", this.offsetIndex);
      this.offsetTime += dur;
      this.offsetIndex++;
    }
  }
}

/*
  A trajectory that moves linearly in blub space and makes something between a parable and a circle in real space
*/
class DirectBlubSpaceTrajectory implements Trajectory {
  constructor(
    public start: Point2D,
    public end: Point2D,
    public origin: Point3D,
    public target: Point3D,
    public xyDirection: Point3D,
    public duration: number,
  ) {}

  position(t: number): Point3D {
    if (t >= this.duration) {
      return this.target;
    }
    const progress = t / this.duration;
    const pointInBlub = this.start.plus(
      this.end.minus(this.start).mul(progress),
    );

    const { dist, zoom } = fromBlubSpace(pointInBlub, segmentSize);
    const pointInReal = this.origin.plus(this.xyDirection.mul(dist));
    pointInReal.z = zoom;
    return pointInReal;
  }

  reverse(): Trajectory & { origin: Point3D } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      duration: self.duration,
      origin: self.target,
      position(t: number): Point3D {
        if (t >= self.duration) {
          return self.origin;
        }
        return self.position(self.duration - t);
      },
    };
  }
}

// A trajectory that moves on a line from origin to target in real space
class RealSpaceTrajectory implements Trajectory {
  direct: Point3D;
  constructor(
    private origin: Point3D,
    private target: Point3D,
    public duration: number,
  ) {
    this.direct = target.minus(origin);
  }

  position(t: number): Point3D {
    if (t >= this.duration) {
      return this.target;
    }
    const progress = t / this.duration;
    return this.origin.plus(this.direct.mul(progress));
  }
}

/**
 * Moves along multiple trajectories
 */
class CompositeTrajectory implements Trajectory {
  constructor(private trajectories: Trajectory[]) {
    this.duration = trajectories.reduce((sum, t) => sum + t.duration, 0);
  }
  duration: number;

  // private offsetTime: number = 0;
  // private offsetIndex: number = 0;
  // position(t: number): Point3D {
  //   let rest = t - this.offsetTime;
  //   while (this.offsetIndex < this.trajectories.length - 1 && rest >= this.trajectories[this.offsetIndex].duration) {
  //     rest -= this.trajectories[this.offsetIndex].duration;
  //     this.offsetTime += this.trajectories[this.offsetIndex].duration;
  //     this.offsetIndex++;
  //     console.log("switch to next trajectory", this.offsetIndex);
  //   }
  //   return this.trajectories[this.offsetIndex].position(rest);
  // }

  position(t: number): Point3D {
    let rest = t;
    for (const trajectory of this.trajectories) {
      if (rest < trajectory.duration) {
        return trajectory.position(rest);
      }
      rest -= trajectory.duration;
    }
    return this.trajectories[this.trajectories.length - 1].position(
      this.trajectories[this.trajectories.length - 1].duration,
    );
  }
}

const segmentSize = 500;
const minZoom = 2;
const targetMinZoom = 1;

export function plotSmartTrajectory(
  origin: Point3D,
  target: Point3D,
): Trajectory {
  return new TimeInterpolatingTrajectory(
    plotSmartTrajectoryInner(origin, target),
  );
}

function plotSmartTrajectoryInner(
  origin: Point3D,
  target: Point3D,
): Trajectory {
  const direct = target.minus(origin);
  const xyDistance = Math.sqrt(direct.x ** 2 + direct.y ** 2);
  const xyDirection = new Point3D(
    direct.x / xyDistance,
    direct.y / xyDistance,
    0,
  );

  // console.log("plotSmartTrajectory", {
  //   origin,
  //   target,
  //   xyDistance,
  //   xyDirection,
  // });
  if (xyDistance <= 0) {
    // if xyDistance is 0 we just have to zoom in
    return new RealSpaceTrajectory(origin, target, 1);
  }

  function makeIndirectTrajectory(): Trajectory {
    //console.assert(origin.z <= targetMinZoom)
    //console.assert(target.z <= targetMinZoom);
    const zoomOutTrajectory = makeFullZoomOutTrajectory(
      origin,
      xyDirection,
      1 / 3,
      targetMinZoom,
    );
    const zoomInTrajectory = makeFullZoomOutTrajectory(
      target,
      xyDirection.neg(),
      1 / 3,
      targetMinZoom,
    ).reverse();
    const topLevelZoomTrajectory = new RealSpaceTrajectory(
      zoomOutTrajectory.target,
      zoomInTrajectory.origin,
      1 / 10,
    );
    //console.log("makeIndirectTrajectory", { zoomOutTrajectory, topLevelZoomTrajectory, zoomInTrajectory });
    return new CompositeTrajectory([
      zoomOutTrajectory,
      topLevelZoomTrajectory,
      zoomInTrajectory,
    ]);
  }

  // first check if we can project the flight path into a blub space segment (aka a half circle)
  if (xyDistance < segmentSize) {
    const start = toBlubSpace(0, origin.z, segmentSize);
    const end = toBlubSpace(xyDistance, target.z, segmentSize);

    if (origin.z <= targetMinZoom && target.z <= targetMinZoom) {
      // if we are not already zoomed out more than targetMinZoom
      // check whether the line intersects the targetMinZoom circle
      // otherwise we would zoom out more than targetMinZoom
      if (
        lineIntersectsCircle(
          start,
          end,
          new Point2D(0, 0),
          zoomToBlubRadius(targetMinZoom),
        )
      ) {
        // if the line intersects the targetMinZoom circle, we need to zoom out to targetMinZoom and then do a full zoom in
        return makeIndirectTrajectory();
      }
    }

    //console.log("plotSmartTrajectory", { start, end });
    return new DirectBlubSpaceTrajectory(
      start,
      end,
      origin,
      target,
      xyDirection,
      1,
    );
  } else if (origin.z > targetMinZoom) {
    // if we are zoomed out more than the targetMinZoom,
    // don't zoom out at all, just move at the current zoom level and then zoom in
    const zoomInTrajectory = makeFullZoomOutTrajectory(
      target,
      xyDirection.neg(),
      1 / 2,
      origin.z,
    ).reverse();
    const topLevelZoomTrajectory = new RealSpaceTrajectory(
      origin,
      zoomInTrajectory.origin,
      1 / 2,
    );
    //console.log("onlyZoomIn", { topLevelZoomTrajectory, zoomInTrajectory });
    return new CompositeTrajectory([topLevelZoomTrajectory, zoomInTrajectory]);
  } else {
    // the targets are further away than a segment, so we need to zoom out fully to the target zoom level and zoom in again
    return makeIndirectTrajectory();
  }
}
/**
 * Checks whether the line between p1 and p2 intersects a circle with center circle and radius radius
 */
function lineIntersectsCircle(
  p1: Point2D,
  p2: Point2D,
  circle: Point2D,
  radius: number,
) {
  // no idea whats going on here... it's adapted from the INTERNET!
  const v1 = {
    x: p2.x - p1.x,
    y: p2.y - p1.y,
  };
  const v2 = {
    x: p1.x - circle.x,
    y: p1.y - circle.y,
  };
  const b = -2 * (v1.x * v2.x + v1.y * v2.y);
  const c = 2 * (v1.x * v1.x + v1.y * v1.y);
  const d = Math.sqrt(
    b * b - 2 * c * (v2.x * v2.x + v2.y * v2.y - radius * radius),
  );
  if (isNaN(d)) {
    // no intercept
    return false;
  }
  const u1 = (b - d) / c; // these represent the unit distance of point one and two on the line
  const u2 = (b + d) / c;
  return (u1 <= 1 && u1 >= 0) || (u2 <= 1 && u2 >= 0);
}

/**
 * Creates a trajectory that zooms out from origin to the targetZoom level in the xy direction
 * Because it moves to the tangent of the targetZoom circle in blub space, it makes a nice approaching curve in real space
 */
function makeFullZoomOutTrajectory(
  origin: Point3D,
  xyDirection: Point3D,
  duration: number,
  targetZoom: number,
): DirectBlubSpaceTrajectory {
  const zoomOutStart = toBlubSpace(0, origin.z, segmentSize);
  const zoomOutEnd = circleTangentPointFrom0Origin(
    zoomOutStart,
    zoomToBlubRadius(targetZoom),
  );
  const { dist: zoomOutEndDist, zoom: zoomOutEndZoom } = fromBlubSpace(
    zoomOutEnd,
    segmentSize,
  );
  const zoomOutEndInReal = origin.plus(xyDirection.mul(zoomOutEndDist));
  zoomOutEndInReal.z = zoomOutEndZoom;

  //console.log("makeFullZoomOutTrajectory", { origin, zoomOutStart, zoomOutEnd, zoomOutEndInReal });

  return new DirectBlubSpaceTrajectory(
    zoomOutStart,
    zoomOutEnd,
    origin,
    zoomOutEndInReal,
    xyDirection,
    duration,
  );
}

/**
 * Calculates the point on the circle with radius radius so that the line from p to the calculated point is tangent to the circle
 */
function circleTangentPointFrom0Origin(p: Point2D, radius: number): Point2D {
  const startRadius = p.length();
  const zoomOutAngle = Math.acos(radius / startRadius);
  return new Point2D(
    Math.cos(zoomOutAngle) * radius,
    Math.sin(zoomOutAngle) * radius,
  );
}

const zoomRadiusOffset = minZoom + 0.1;
function zoomToBlubRadius(zoom: number): number {
  return zoomRadiusOffset - zoom;
}

function blubRadiusToZoom(radius: number): number {
  return zoomRadiusOffset - radius;
}

function toBlubSpace(dist: number, zoom: number, segmentSize: number): Point2D {
  const radius = zoomToBlubRadius(zoom);
  const angle = (dist / segmentSize) * Math.PI;
  return new Point2D(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function fromBlubSpace(
  p: Point2D,
  segmentSize: number,
): { dist: number; zoom: number } {
  const radius = Math.sqrt(p.x ** 2 + p.y ** 2);
  const angle = Math.atan2(p.y, p.x);
  return {
    dist: (angle / Math.PI) * segmentSize,
    zoom: blubRadiusToZoom(radius),
  };
}
