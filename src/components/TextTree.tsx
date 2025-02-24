import { Html } from "@react-three/drei";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useDelay } from "../lib/delayRender";
import { DetailLevelObservable } from "../lib/DetailLevelObservable";
import { DIGITS, LazyPrefixInfo } from "../lib/info-map";
import { getGroup, resolveOnePrefixLevel } from "../lib/prefix-data";
import { Store } from "../lib/Store";
import {
  calculateCheckDigit,
  digits,
  isbnPrefixAppend,
  IsbnPrefixWithDashes,
  IsbnStrWithChecksum,
  ProjectionConfig,
  removeDashes,
} from "../lib/util";
import { SingleBookCover } from "./SingleBookCover";
export const TextTree: React.FC<{
  config: ProjectionConfig;
  store: Store;
  prefix: IsbnPrefixWithDashes;
}> = observer(function _TextTree(props) {
  const groupPrefix = removeDashes(props.prefix);

  const view = props.store.getDetailLevel(groupPrefix);
  if (!view.container) return null;
  return <GroupShowInner {...props} view={view} />;
});
const GroupShowInner: React.FC<{
  config: ProjectionConfig;
  store: Store;
  prefix: IsbnPrefixWithDashes;
  view: DetailLevelObservable;
}> = observer(function _GroupShowInner({ view, ...props }) {
  const { position, width, height } = view.planePosition;
  const [groupO, setGroupO] = useState<LazyPrefixInfo | null>(null);

  useEffect(() => {
    (async () => {
      // resolve group plus one child level
      let g = getGroup(props.store.rootPrefixInfo, props.prefix);
      const jsonRoot = props.store.runtimeConfig.jsonRoot;
      if (typeof g === "function")
        g = await props.store.trackAsyncProgress(
          `resolvePublishers(${props.prefix})`,
          g(jsonRoot),
        );
      if (g?.children && "lazy" in g.children) {
        await resolveOnePrefixLevel(g, jsonRoot);
      }
      setGroupO(g);
    })();
  }, [props.prefix]);
  return (
    <>
      <RenderGroup
        store={props.store}
        prefix={props.prefix}
        group={groupO}
        position={position}
        width={width}
        height={height}
        view={view}
      />

      {view.textChildren &&
        // groupO?.children &&
        digits.map((i) => {
          return (
            <TextTree
              key={props.prefix + i}
              prefix={isbnPrefixAppend(
                (groupO?.info?.[0].prefix
                  ? groupO.info[0].prefix + "-"
                  : props.prefix) as IsbnPrefixWithDashes,
                String(i),
              )}
              config={props.config}
              store={props.store}
            />
          );
        })}
    </>
  );
});
const RenderGroup: React.FC<{
  store: Store;
  group: LazyPrefixInfo | null;
  prefix: IsbnPrefixWithDashes;
  position: [number, number, number];
  width: number;
  height: number;
  view: DetailLevelObservable;
}> = observer(function _RenderGroup({
  store,
  group,
  prefix,
  position,
  width,
  height,
  view,
}) {
  const shouldDelay = useDelay();
  if (!shouldDelay) return null;
  const plainPrefix = removeDashes(prefix);
  const isSingleBook = plainPrefix.length === 11;
  // console.log("RenderGroup " + prefix);
  if (!view.textOpacity || (!group?.children && !isSingleBook)) return null;
  const smSize = Math.min(width, height);
  const vertical = height > width;
  const showVertical = store.runtimeConfig.groupTextVertical || isSingleBook;
  if (group || isSingleBook) {
    return (
      <group position={[position[0], position[1], 20 - plainPrefix.length]}>
        <Html
          scale={smSize / 2 / Math.sqrt(10)}
          zIndexRange={[12 - plainPrefix.length, 12 - plainPrefix.length]}
          center
          transform
          sprite={false}
          rotation={[0, 0, !vertical && showVertical ? Math.PI / 2 : 0]}
          pointerEvents="none"
          className={
            (!vertical && !showVertical ? "vertical " : "") + "group-name-wrap"
          }
          style={{ opacity: view.textOpacity }}
        >
          {isSingleBook ? (
            <ChildBooks
              store={store}
              showVertical={showVertical}
              prefix={prefix}
              vertical={vertical}
            />
          ) : group ? (
            <ChildGroupNames
              store={store}
              showVertical={showVertical}
              group={group}
              prefix={prefix}
              vertical={vertical}
            />
          ) : (
            "impossible"
          )}
        </Html>
      </group>
    );
  }
  return null;
});

function ChildBooks(props: {
  prefix: IsbnPrefixWithDashes;
  vertical: boolean;
  showVertical: boolean;
  store: Store;
}) {
  const plainPrefix = removeDashes(props.prefix);
  return (
    <div>
      {DIGITS.map((digit) => (
        <div key={digit} className={"single-book-wrap"}>
          <SingleBookCover
            store={props.store}
            isbn={
              (plainPrefix +
                digit +
                calculateCheckDigit(plainPrefix + digit)) as IsbnStrWithChecksum
            }
          />
        </div>
      ))}
    </div>
  );
}

function ChildGroupNames(props: {
  prefix: IsbnPrefixWithDashes;
  group: LazyPrefixInfo;
  vertical: boolean;
  showVertical: boolean;
  store: Store;
}) {
  if (!props.group.children) return null;
  if ("lazy" in props.group.children) {
    console.warn("lazy group, should be impossible", props.prefix);
    return null;
  }
  const children = props.group.children;
  const prefixWithAppendedDash = props.group.info?.[0].prefix
    ? props.group.info[0].prefix + "-"
    : props.prefix;
  return (
    <div>
      {DIGITS.map((digit) => {
        const child = children[digit];
        return (
          <div
            key={digit}
            className={
              "group-name " +
              (!props.vertical && !props.showVertical ? "vertical " : "")
            }
          >
            {child && (
              <GroupNameTxt
                prefix={prefixWithAppendedDash + digit}
                group={child}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
const GroupNameTxt = function GroupName(props: {
  prefix: string;
  group: LazyPrefixInfo;
}) {
  const firstInfo = props.group.info?.[0];
  const infoCount = props.group.info?.length || 0;
  if (!firstInfo) {
    return (
      <small>
        {`${props.group.totalChildren} publisher${
          props.group.totalChildren > 1 ? "s" : ""
        }`}
        <br />
        <small>{`(${props.prefix})`}</small>
      </small>
    );
  }
  if (firstInfo.source === "isbngrp") {
    return (
      <>
        {firstInfo.registrant_name}
        <br />
        <small>
          {`(${firstInfo.prefix}) ${
            infoCount > 1 ? `(+${infoCount - 1} more)` : ""
          }`}
        </small>
      </>
    );
  }
  return (
    <>
      {firstInfo.name}
      <br />
      <small>{`(${firstInfo.prefix}-)`}</small>
    </>
  );
};
