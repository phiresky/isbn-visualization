import { useEffect, useState } from "react";

const maxPerFrame = 1;
const pending: (() => void)[] = [];
function clearT() {
  let remaining = pending.length > 10 ? maxPerFrame * 2 : maxPerFrame;
  while (pending.length > 0 && remaining > 0) {
    pending.pop()?.();
    remaining--;
  }
  requestAnimationFrame(clearT);
}
clearT();

export function useDelay() {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    const fn = () => setYes(true);
    pending.push(fn);
    return () => {
      const inx = pending.indexOf(fn);
      if (inx >= 0) pending.splice(inx, 1);
    };
  }, []);
  return yes;
}
