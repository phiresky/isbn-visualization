import { Html } from "@react-three/drei";
import { hyphenate } from "isbn3";
import { observer } from "mobx-react-lite";
import React from "react";
import { LazyPrefixInfo } from "../lib/info-map";
import { Store } from "../lib/Store";
import { relativeToFullIsbn, removeDashes, siNumber } from "../lib/util";
import { getPlanePosition } from "../lib/view-utils";
import { AbbrevStats, maxZoomForStats } from "./StatsShow";

export const PublisherHighlightShow: React.FC<{ store: Store }> = observer(
  function PublisherHighlightShow({ store }) {
    if (store.highlightedIsbn.type === "done") return null;
    if (!store.highlightedPublisher) return null;
    const isbn = store.highlightedPublisher.relative;
    const isbnFull = relativeToFullIsbn(isbn);
    const loc = getPlanePosition(store.projection, isbn, isbn);
    const publisher = store.highlightedPublisher.data?.[1]?.info?.[0];
    return (
      <>
        <group position={[loc.position[0], loc.position[1], 2]}>
          <group position={[0, -loc.height / 2, 0]}>
            {/*<HighlightCircle store={store} />*/}
            <Html
              style={{ pointerEvents: "none" }}
              zIndexRange={[20, 20]}
              // wrapperClass="highlight-wrapper"
            >
              <div className="isbn-highlight">
                ISBN {hyphenate(isbnFull) || isbnFull}
                <br />
                {(store.highlightedPublisher.data &&
                  store.highlightedPublisher.obj && (
                    <GroupInfo
                      groupInfo={store.highlightedPublisher.data}
                      obj={store.highlightedPublisher.obj}
                    />
                  )) || <div>Unassigned or unknown range</div>}
                <br />
                {publisher && (
                  <AbbrevStats
                    prefixStart={publisher.prefix}
                    prefixEnd={publisher.prefix}
                    store={store}
                  />
                )}
                <b>Click to show book details</b>
                <br />
                {store.floatZoomFactor < maxZoomForStats && (
                  <small>Right-click-drag to show region stats</small>
                )}
              </div>
            </Html>
          </group>
        </group>
      </>
    );
  }
);
export const HighlightShow: React.FC<{ store: Store }> = observer(
  function HighlightShow({ store }) {
    if (store.highlightedIsbn.type === "todo") return null;
    const isbn = store.highlightedIsbn.relative;
    const loc = getPlanePosition(store.projection, isbn, isbn);
    return (
      <>
        <group position={[loc.position[0], loc.position[1], 2]}>
          {/* <Plane args={[loc.width, loc.height]} material={material} />*/}
          <Html style={{ pointerEvents: "none" }} zIndexRange={[19, 19]}>
            <HighlightCircle store={store} />
          </Html>
          <group position={[0, -loc.height / 2, 0]}>
            {/*<HighlightCircle store={store} />*/}
            <Html
              style={{ pointerEvents: "none" }}
              zIndexRange={[20, 20]}
              // wrapperClass="highlight-wrapper"
            >
              <IsbnInfo store={store} />
            </Html>
          </group>
        </group>
      </>
    );
  }
);

const HighlightCircle: React.FC<{ store: Store }> = observer(
  function HighlightCircle(props: { store: Store }) {
    const store = props.store;
    const circleRadius = 30;
    const circleStroke = 4;
    if (store.floatZoomFactor > 5000) return null;
    const svg = (s: React.CSSProperties) => (
      <svg
        style={{
          position: "absolute",
          top: -circleRadius,
          left: -circleRadius,
          ...s,
        }}
        width={circleRadius * 2}
        height={circleRadius * 2}
        viewBox={`0 0 ${circleRadius * 2} ${circleRadius * 2}`}
      >
        {" "}
        <circle
          cx={circleRadius}
          cy={circleRadius}
          r={circleRadius - circleStroke}
          stroke="white"
          strokeWidth={circleStroke}
          fill="none"
        />
      </svg>
    );
    return (
      <div>
        {svg({ filter: "drop-shadow(0 0 4px black)", zIndex: 0 })}
        {/*svg({ zIndex: 30 })*/}
      </div>
    );
  }
);
const IsbnInfo = observer(function IsbnInfo(props: { store: Store }) {
  const o = props.store.highlightedIsbn;
  if (o.type === "todo") return "Hover to see ISBN info";
  let groupInfo;
  if (o.obj) {
    const i = o.obj;
    if (!i.prefix) return <div>imposs: no prefix?</div>;
    const prefixLen = i.prefix.length + i.group.length;
    const totalDigits = 13 - 1; // 13 minus check digit
    const numBooksInGroup = 10 ** (totalDigits - prefixLen);
    const numBooksInPublisher =
      10 ** (totalDigits - prefixLen - i.publisher.length);

    groupInfo = (
      <div>
        <GroupInfo obj={o.obj} groupInfo={o.groupInfo} />
        <br />
        {/*Article: {i.article}*/}
        {o.rarity &&
          (o.rarity.bookCount === 0 ? (
            <>(no holding data)</>
          ) : (
            <>
              {o.rarity.holdingCount === 255 ? ">250" : o.rarity.holdingCount}{" "}
              known libraries hold copies of{" "}
              {o.rarity.editionCount >= 254 ? ">250" : o.rarity.editionCount}{" "}
              editions of this book
            </>
          ))}
        <br />
        <details>
          <summary style={{ pointerEvents: "auto", cursor: "pointer" }}>
            Details
          </summary>
          Num possible ISBNs in group: {siNumber(numBooksInGroup)} <br />
          Num possible ISBNs in publisher: {siNumber(numBooksInPublisher)}{" "}
          <br />
          {o.groupInfo.flatMap((g) =>
            (g.info ?? []).map((info, i) => (
              <li key={info.prefix + i}>
                {info.source === "publisher-ranges" ? (
                  <>
                    Group {info.prefix}: {info.name}
                  </>
                ) : (
                  <>
                    Publisher {info.prefix}: {info.registrant_name} (
                    {info.country_name})
                  </>
                )}
              </li>
            ))
          )}
        </details>
        Look up book on
        <ul>
          {props.store.externalSearchEngines.map((d) => (
            <li key={d.name}>
              <a href={d.url.replace("%s", o.isbn)} target="_blank">
                {d.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  } else {
    groupInfo = <div>Unassigned or unknown range</div>;
  }
  const isbn = o.obj?.isbn13h ?? relativeToFullIsbn(o.relative);

  return (
    <>
      <div
        className="isbn-highlight"
        style={{ pointerEvents: "auto" }}
        onWheelCapture={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          className="float-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.store.highlightedIsbn = { type: "todo" };
          }}
        >
          Close
        </button>
        <button
          className="float-button"
          onClick={() => props.store.zoomAnimateToHighlight()}
        >
          Fly to book
        </button>
        Book:{" "}
        {o.googleBookDetails === "todo" ? (
          <>{isbn}...</>
        ) : o.googleBookDetails === null ? (
          <>{isbn} (not found on Google Books)</>
        ) : (
          <>
            <img
              src={
                o.googleBookDetails.volumeInfo.imageLinks?.smallThumbnail ??
                undefined
              }
              style={{ float: "left" }}
            />
            <b>{o.googleBookDetails.volumeInfo.title}</b>
            <br />
            by {o.googleBookDetails.volumeInfo.authors?.join(", ")}
            <br />
            ISBN: {isbn}
          </>
        )}
        <br />
        {groupInfo}
      </div>
    </>
  );
});

function GroupInfo({
  obj,
  groupInfo,
}: {
  obj: ISBN;
  groupInfo: LazyPrefixInfo[];
}) {
  const publisherPrefix = `${obj.prefix}${obj.group}${obj.publisher}`;
  const computedPublisherInfo = groupInfo.find((g) => {
    const myPrefix = g.info?.[0]?.prefix;
    return myPrefix && removeDashes(myPrefix) === publisherPrefix;
  });

  return (
    <>
      Group {obj.prefix}-{obj.group}: <i>{obj.groupname}</i> <br />
      Publisher {obj.publisher}:{" "}
      <i>
        {computedPublisherInfo?.info &&
        computedPublisherInfo?.info?.[0].source === "isbngrp"
          ? computedPublisherInfo?.info?.[0].registrant_name
          : "unknown"}
      </i>{" "}
      {(computedPublisherInfo?.info?.length ?? 0) > 1
        ? `(+${(computedPublisherInfo?.info?.length ?? 0) - 1} more)`
        : ""}
    </>
  );
}
