import {
  OrbitControls,
  OrbitControlsChangeEvent,
  OrthographicCamera,
  Plane,
} from "@react-three/drei";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import * as isbnlib from "isbn3";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { MeshStandardMaterial, NoToneMapping } from "three";
import { shaderErrorToString } from "../lib/shader-error";
import { Store } from "../lib/Store";
import { IsbnPrefixWithDashes, ProjectionConfig } from "../lib/util";
import { Controls } from "./Controls";
import { HighlightShow, PublisherHighlightShow } from "./Highlight";
import { ImageTree } from "./ImageTree";
import { IsbnGrid } from "./IsbnGrid";
import { MiniMap } from "./MiniMap";
import { StatsShow } from "./StatsShow";
import { TextTree } from "./TextTree";
Object.assign(window, { isbnlib });

let pointerMoved = 0;
let isPointerDown = -1;
let cancelHighlight = false;

export const IsbnMap: React.FC<{ config: ProjectionConfig }> = observer(
  function IsbnView(props: { config: ProjectionConfig }) {
    const [store] = useState(() => new Store(props.config));
    Object.assign(window, { store });

    useEffect(() => {
      function cancelHighlightListener() {
        if (cancelHighlight) store.highlightedPublisher = null;
        else cancelHighlight = true;
      }
      function cancelZoom() {
        // cancel flight on scroll
        cancelAnimationFrame(store.animationRequestId);
      }

      window.addEventListener("wheel", cancelZoom);
      window.addEventListener("pointermove", cancelHighlightListener);
      return () => {
        window.removeEventListener("wheel", cancelZoom);
        window.removeEventListener("pointermove", cancelHighlightListener);
      };
    }, []);

    const transparent = useMemo(
      () =>
        new MeshStandardMaterial({
          color: "green",
          transparent: true,
          opacity: 0,
        }),
      []
    );
    return (
      <>
        <Canvas
          style={{
            width: "100%",
            height: "100%",
            background: "black",
            // position: "relative",
          }}
          flat={true}
          onCreated={(threejsRoot) => {
            Object.assign(window, { threejsRoot });
            // threejsRoot.gl.debug.onShaderError = e => store.shaderError = e;
            store.camera = threejsRoot.camera as THREE.OrthographicCamera;
            threejsRoot.gl.debug.onShaderError = (...args) => {
              const err = shaderErrorToString(...args);
              console.warn(err);
              store.shaderError = err;
            };
          }}
          scene={{ background: new THREE.Color("#1d2636") }}
          gl={{ toneMapping: NoToneMapping }}
        >
          <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={0.8} />
          <OrbitControls
            ref={(e) => {
              store.orbitControls = e;
            }}
            enableDamping={false}
            makeDefault
            enableRotate={false}
            enablePan={true}
            mouseButtons={{ LEFT: THREE.MOUSE.PAN }}
            zoomToCursor={true}
            minZoom={0.5}
            maxZoom={20000}
            touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
            onChange={(e: OrbitControlsChangeEvent) => store.updateView(e)}
          />
          {/*<ambientLight intensity={3} />*/}
          <Plane
            position={[0, 0, 0]}
            material={transparent}
            args={[props.config.pixelWidth, props.config.pixelHeight]}
            onClick={(e: ThreeEvent<PointerEvent>) => {}}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              cancelAnimationFrame(store.animationRequestId);
              pointerMoved = 0;
              isPointerDown = e.button;
              if (e.button === 2) {
                store.highlightedPublisher = null;
                const x = e.point.x + props.config.pixelWidth / 2;
                const y = props.config.pixelHeight / 2 - e.point.y;
                store.updateHighlightedStats(x, y, "start");
              }
            }}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
              isPointerDown = -1;
              if ((e.nativeEvent.target as Element)?.tagName !== "CANVAS")
                return;
              if (pointerMoved < 4) {
                e.stopPropagation();
                const x = e.point.x + props.config.pixelWidth / 2;
                const y = props.config.pixelHeight / 2 - e.point.y;
                if (e.button === 2) {
                  // store.updateStats(x, y, "end");
                  store.highlightedStats = null;
                } else {
                  store.updateHighlight(x, y, false);
                }
              }
            }}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              cancelHighlight = false;
              pointerMoved++;
              const x = e.point.x + props.config.pixelWidth / 2;
              const y = props.config.pixelHeight / 2 - e.point.y;
              if (isPointerDown === 2) {
                if ((e.nativeEvent.target as Element)?.tagName !== "CANVAS")
                  return;
                store.updateHighlightedStats(x, y, "end");
              }
              if (isPointerDown === -1 && e.pointerType === "mouse") {
                if ((e.nativeEvent.target as Element)?.tagName !== "CANVAS")
                  return;
                e.stopPropagation();

                store.updateHighlight(x, y, true);
              }
            }}
          />
          <group
            position={[
              -props.config.pixelWidth / 2,
              props.config.pixelHeight / 2,
              0,
            ]}
          >
            <PublisherHighlightShow store={store} />
            <HighlightShow store={store} />
            <StatsShow store={store} />
            {store.runtimeConfig.showPublisherNames && (
              <>
                <TextTree
                  config={props.config}
                  prefix={"978-" as IsbnPrefixWithDashes}
                  store={store}
                />
                <TextTree
                  config={props.config}
                  prefix={"979-" as IsbnPrefixWithDashes}
                  store={store}
                />
              </>
            )}
            <ImageTree
              store={store}
              config={props.config}
              prefix={"978-" as IsbnPrefixWithDashes}
              blending={THREE.NormalBlending}
            />
            <ImageTree
              store={store}
              config={props.config}
              prefix={"979-" as IsbnPrefixWithDashes}
              blending={THREE.NormalBlending}
            />
            {store.runtimeConfig.showGrid && <IsbnGrid store={store} />}
          </group>
        </Canvas>
        <Controls store={store} />
        <MiniMap store={store} />
      </>
    );
  }
);
