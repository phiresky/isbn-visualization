import { Vector3Like } from "three/src/math/Vector3";

export class Point implements Vector3Like {
  constructor(public x: number, public y: number, public z: number) { }
  
  plus(p: Point) {
    return new Point(this.x + p.x, this.y + p.y, this.z + p.z);
  }
  minus(p: Point) {
    return new Point(this.x - p.x, this.y - p.y, this.z - p.z);
  }
  mul(s: number) {
    return new Point(this.x * s, this.y * s, this.z * s);
  }
  div(s: number) {
    return new Point(this.x / s, this.y / s, this.z / s);
  }
  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }
  distance(p: Point) {
    return Math.sqrt((this.x - p.x) ** 2 + (this.y - p.y) ** 2 + (this.z - p.z) ** 2);
  }
  toString() {
    return `(${this.x}, ${this.y}, ${this.z})`;
  }
}

export interface Trajectory extends Object {
  position(t: number): Point;
  duration: number;
}


export function getTrajectoryReal2(before: Point, after: Point): Trajectory {
  // add flight duration to each point based on the distance to prev point
  const traj: (Point & { t: number })[] = getTrajectoryReal(
    before,
    after
  ) as any;
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
              (traj[i].z - traj[i - 1].z) ** 2
          );
    const t =
      distance *
      Math.min(
        3000,
        i === 0 ? 1 / traj[i].z : (1 / traj[i].z + 1 / traj[i - 1].z) / 2
      );
    totalT += t;
    traj[i].t = t;
  }
  // limit max flight duration
  if (totalT > 2000) {
    for (const p of traj) {
      p.t *= 2000 / totalT;
    }
  }
 
  let curSegment = 1;
  let curTOffset = 0;

  return {
    position(time: number): Point {
      let rest = time - curTOffset;
      while (true) {
        if (curSegment >= traj.length) {
          return after;
        }

        if (rest <= traj[curSegment].t) {
          break;
        }
          
        curTOffset += traj[curSegment].t;
        curSegment++;
        rest = time - curTOffset;
      }


      const segment = traj[curSegment];
      const lastSegment = traj[curSegment - 1];
      const progress = rest / segment.t;
      return new Point(
        lastSegment.x + (segment.x - lastSegment.x) * progress,
        lastSegment.y + (segment.y - lastSegment.y) * progress,
        lastSegment.z + (segment.z - lastSegment.z) * progress,
      );
    },
    duration: totalT,
    toString() {
      return traj.map((p) => p.toString()).join(" -> ");
    }
  };
}


function getTrajectoryReal(before: Point, after: Point) {
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
  y2: number
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













class Point2D {
  constructor(public x: number, public y: number) { }
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




const segmentSize = 700;
export function plotSmartTrajectory(origin: Point, target: Point): Trajectory {
  const direct = target.minus(origin);
  const xyDistance = Math.sqrt(direct.x ** 2 + direct.y ** 2);
  const xyDirection = new Point(direct.x / xyDistance, direct.y / xyDistance, 0);

  console.log("plotSmartTrajectory", { origin, target, xyDistance, xyDirection });
  if (xyDistance <= 0 || xyDistance > segmentSize) {
    return {
      duration: 0,
      position(t: number): Point {
        return target;
      }
    }
  }

  const start = toBlubSpace(0, origin.z, segmentSize);
  const end = toBlubSpace(xyDistance, target.z, segmentSize);

  console.log("plotSmartTrajectory", { start, end });
  const blubDirect = end.minus(start);
  const duration = 200 + 1.2 * xyDistance;
  return {
    duration,
    position(t: number): Point {
      if (t >= duration) {
        return target;
      }
      const progress = Math.sin(t / duration * Math.PI / 2);
      const pointInBlub = start.plus(blubDirect.mul(progress));
      const { dist, zoom } = fromBlubSpace(pointInBlub, segmentSize);
      const pointInReal = origin.plus(xyDirection.mul(dist));
      pointInReal.z = zoom;
      console.log({pointInReal, pointInBlub, dist, zoom, progress, t});
      return pointInReal;
    }
  }
}

const zoomRadiusOffset = 1.5;
function toBlubSpace(dist: number, zoom: number, segmentSize: number): Point2D {
  let radius = zoomRadiusOffset - zoom;
  let angle = dist / segmentSize * Math.PI;
  return new Point2D(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
}

function fromBlubSpace(p: Point2D, segmentSize: number): {dist: number, zoom: number} {
  let radius = Math.sqrt(p.x ** 2 + p.y ** 2);
  let angle = Math.atan2(p.y, p.x);
  return {
    dist: angle / Math.PI * segmentSize,
    zoom: zoomRadiusOffset - radius,
  }
}

// x, y, z are between 0 and 1
// everything with z = 0 has the blub space coordinates (0, 0, 0)
// project every point (x, y, z) in normal space so that in blub space it has exactly distance z from (0, 0, 0)
const segmentAngle = Math.PI;
const zoomDistortion = 20000 // distorts the radius so that it mimics the zoom factor

/*function toBlubSpace(p: Point) {
  let radius = p.z ** (1/ zoomDistortion);
  let angle1 = p.x * maxAngle;
  let angle2 = p.y * maxAngle;
  return new Point(
    radius * Math.sin(angle1) * Math.cos(angle2),
    radius * Math.sin(angle1) * Math.sin(angle2),
    radius * Math.cos(angle1),
  );
}

function fromBlubSpace(p: Point) {
  let radius = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
  let angle1 = Math.acos(p.z / radius);
  let angle2 = Math.atan2(p.y, p.x);
  return new Point(
    angle2 / maxAngle,
    angle1 / maxAngle,
    radius ** zoomDistortion,
  );
}*/