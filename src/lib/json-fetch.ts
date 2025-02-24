export async function fetchJson<T>(fname: string) {
  const config = (await import("../config")).default;
  const gzip = config.jsonCompression === "gzip";
  const res = await fetch(`${fname}${gzip ? ".gz" : ""}`);
  if (!res.ok)
    throw Error(String(res.status) + " " + res.statusText, { cause: res });
  let stream = res.body;
  if (!stream) throw Error("No body");
  if (
    gzip &&
    /* vite dev server has a bug where it sends gzip files as content-encoding gzip
     */
    (import.meta.env.MODE !== "development" || fname.startsWith("https://"))
  )
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  const map = (await new Response(stream).json()) as T;
  return map;
}
