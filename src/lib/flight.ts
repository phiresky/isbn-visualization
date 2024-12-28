type Point = { x: number; y: number; z: number };
export function getTrajectoryReal2(before: Point, after: Point) {
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
  return traj;
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
