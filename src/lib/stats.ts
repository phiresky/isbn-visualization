import { fetchJson } from "./json-fetch";
import { Store } from "./Store";
import { IsbnPrefixWithoutDashes } from "./util";

export type StatsMap = Partial<Record<IsbnPrefixWithoutDashes, BlockStats>>;
export type BlockStats = Partial<Record<string, number>>;
export class StatsCalculator {
  #data: StatsMap | null = null;
  constructor(private store: Store) {}
  #getRanges(
    startPrefix: IsbnPrefixWithoutDashes,
    endPrefix: IsbnPrefixWithoutDashes,
  ) {
    const components: string[] = [];
    function recurse(prefix: string, left: string, right: string) {
      if (left.length === 0 && right.length === 0) {
        components.push(prefix);
        return;
      }
      const leftDigit = left[0];
      const rightDigit = right[0];
      if (leftDigit === rightDigit) {
        recurse(prefix + left[0], left.slice(1), right.slice(1));
        return;
      }
      if (leftDigit > rightDigit) {
        throw Error("leftDigit > rightDigit");
      }
      if (left.length === 1) components.push(prefix + leftDigit);
      else if (left.length > 1) recurse(prefix + leftDigit, left.slice(1), "9");
      for (let i = +leftDigit + 1; i < +rightDigit; i++) {
        components.push(prefix + String(i));
      }
      if (right.length === 1) components.push(prefix + rightDigit);
      else if (right.length > 1)
        recurse(prefix + rightDigit, "0", right.slice(1));
    }

    recurse("", startPrefix, endPrefix);
    return components as IsbnPrefixWithoutDashes[];
  }
  async #fetchStats(): Promise<StatsMap> {
    if (!this.#data) {
      this.#data = await fetchJson<StatsMap>(
        `${this.store.runtimeConfig.jsonRoot}/stats.json`,
      );
    }
    return this.#data;
  }
  async getStats(
    startPrefix: IsbnPrefixWithoutDashes,
    endPrefix: IsbnPrefixWithoutDashes,
  ) {
    const ranges = this.#getRanges(startPrefix, endPrefix);
    const stats = await this.#fetchStats();
    const output: BlockStats = {};
    for (const range of ranges) {
      const cur = stats[range];
      if (cur) mergeStats(output, cur);
    }
    return output;
  }
}

export function mergeStats(target: BlockStats, source: BlockStats) {
  for (const key in source) {
    target[key] = (target[key] ?? 0) + (source[key] ?? 0);
  }
}
