import { Html, Plane } from "@react-three/drei";
import { observer, useLocalObservable } from "mobx-react-lite";
import { fromPromise } from "mobx-utils";
import React, { useMemo } from "react";
import { MeshBasicMaterial } from "three";
import { BlockStats } from "../lib/stats";
import { Store } from "../lib/Store";
import {
  firstIsbnInPrefix,
  IsbnPrefixWithDashes,
  IsbnPrefixWithoutDashes,
  lastIsbnInPrefix,
  removeDashes,
} from "../lib/util";
import { getPlanePosition } from "../lib/view-utils";

export const StatsShow: React.FC<{ store: Store }> = observer(
  function StatsShow({ store }) {
    const material = useMemo(
      () =>
        new MeshBasicMaterial({
          color: "#ccffcc",
          transparent: true,
          opacity: 0.9,
        }),
      []
    );
    const state = useLocalObservable(() => ({
      get edge() {
        if (!store.highlightedStats) return null;
        let p1: string = store.highlightedStats.prefixStart;
        let p2: string = store.highlightedStats.prefixEnd;
        p1 = p1.slice(0, p2.length);
        p2 = p2.slice(0, p1.length);
        if (p2 < p1) [p1, p2] = [p2, p1];
        while (p1.slice(0, -1) !== p2.slice(0, -1)) {
          p1 = p1.slice(0, -1);
          p2 = p2.slice(0, -1);
        }
        /*if (p2 > p1) {
          p2 = String(+p2 - 1);
        }*/
        return [p1 as IsbnPrefixWithoutDashes, p2 as IsbnPrefixWithoutDashes];
      },
      get stats() {
        if (!this.edge) return null;
        return fromPromise(
          store.statsCalculator.getStats(this.edge[0], this.edge[1])
        );
      },
    }));
    if (!state.edge) return null;
    const [p1, p2] = state.edge;

    const start = firstIsbnInPrefix(p1);
    const end = lastIsbnInPrefix(p2);
    const plane = getPlanePosition(store.projection, start, end);

    return (
      <group position={[plane.position[0], plane.position[1], 2]}>
        <Plane args={[plane.width, plane.height]} material={material} />
        <Html
          zIndexRange={[23, 23]}
          position={[plane.width / 2, -plane.height / 2, 3]}
        >
          <div className="stats-highlight">
            {state.stats?.case({
              pending: () => <>Loading...</>,
              rejected: () => <>Error</>,
              fulfilled: (stats) => (
                <>
                  <AbbrevStats
                    store={store}
                    prefixStart={
                      p1.replace(/^.../, (e) => e + "-") as IsbnPrefixWithDashes
                    }
                    prefixEnd={
                      p2.replace(/^.../, (e) => e + "-") as IsbnPrefixWithDashes
                    }
                  />
                  <details>
                    <summary>Details</summary>
                    <table className="stats-table">
                      <tbody>
                        <tr>
                          <td>{(stats.dataset_all || 0).toLocaleString()}</td>
                          <td>
                            <b>books total</b>
                          </td>
                          <td></td>
                        </tr>
                        {Object.entries(stats).map((s) => (
                          <tr key={s[0]}>
                            <td>{s[1]?.toLocaleString()}</td>
                            <td>in {s[0]}</td>
                            <td>
                              (
                              {(((s[1] ?? 0) / (stats.dataset_all ?? 0)) * 100)
                                .toFixed(2)
                                .padStart(5, " ")}
                              %)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              ),
            })}
          </div>
        </Html>
      </group>
    );
  }
);
export const AbbrevStats: React.FC<{
  store: Store;
  prefixStart: IsbnPrefixWithDashes;
  prefixEnd: IsbnPrefixWithDashes;
}> = observer(function AbbrevStats({ store, prefixStart, prefixEnd }) {
  const [p1, p2] = [removeDashes(prefixStart), removeDashes(prefixEnd)];
  const stats = useMemo(
    () => fromPromise(store.statsCalculator.getStats(p1, p2)),
    [p1, p2]
  );
  return (
    <div>
      {stats.case({
        fulfilled: (r) => (
          <StatsSummary
            stats={r}
            prefixStart={prefixStart}
            prefixEnd={prefixEnd}
          />
        ),
      })}
    </div>
  );
});

function StatsSummary(props: {
  stats: BlockStats;
  prefixStart: IsbnPrefixWithDashes;
  prefixEnd: IsbnPrefixWithDashes;
}) {
  const r = props.stats;
  if (!r.dataset_all) return <></>;
  return (
    <div>
      Stats for {props.prefixStart}
      {props.prefixStart !== props.prefixEnd ? <> to {props.prefixEnd}</> : ""}:
      <br />
      <b>Known books:</b> {r.dataset_all?.toLocaleString()}
      <br />
      <b>dataset_md5:</b> {r.dataset_md5 ?? 0} (
      {(((r.dataset_md5 ?? 0) / (r.dataset_all ?? 0)) * 100).toFixed(2)}
      %)
      <br />
      <b>Average publication year:</b>{" "}
      {r.publication_date_count && (
        <>
          {((r.publication_date ?? 0) / r.publication_date_count).toFixed(0)} (
          {(r.publication_date_count ?? 0).toFixed(0)} samples)
          <br />
        </>
      )}
      <b>Average holdings:</b>{" "}
      {((r.rarity_holdingCount ?? 0) / (r.rarity_exists ?? 0)).toFixed(1)}{" "}
      libraries
      <br />
      <b>Average editions:</b>{" "}
      {((r.rarity_editionCount ?? 0) / (r.rarity_exists ?? 0)).toFixed(1)}
    </div>
  );
}
