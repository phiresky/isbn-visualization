import { Grid } from "@react-three/drei";
import { computed } from "mobx";
import { observer, useLocalObservable } from "mobx-react-lite";
import config from "../config";
import { Store } from "../lib/Store";
import { totalIsbns } from "../lib/util";

export const IsbnGrid: React.FC<{ store: Store }> = observer(function IsbnGrid({
  store,
}) {
  const zoomLevel = computed(() => {
    const zoom = store.floatZoomFactor;

    const zoomLevel = Math.round(Math.log10(zoom) * 2) - 1;
    if (zoomLevel < 0) return 0;
    const maxZoom = 6;
    if (zoomLevel > maxZoom) return maxZoom;
    return zoomLevel;
  }).get();
  const maxShowZoom = store.runtimeConfig.doBookshelfEffect ? 6 : 8;
  const color =
    zoomLevel > 4 ? config.bookshelfColorHex : store.runtimeConfig.gridColor;
  return (
    <>
      <IsbnGridLevel
        key={zoomLevel}
        zoomLevel={zoomLevel}
        store={store}
        thickness={3}
        z={1.2}
        color={color}
      />
      {store.runtimeConfig.gridLevels >= 2 && zoomLevel + 1 <= maxShowZoom && (
        <IsbnGridLevel
          key={zoomLevel + 1}
          zoomLevel={zoomLevel + 1}
          store={store}
          thickness={2}
          z={1.1}
          color={"#333333"}
        />
      )}
      {store.runtimeConfig.gridLevels >= 3 && zoomLevel + 2 <= maxShowZoom && (
        <IsbnGridLevel
          key={zoomLevel + 2}
          zoomLevel={zoomLevel + 2}
          store={store}
          thickness={1}
          z={1.0}
          color={"#333333"}
        />
      )}
    </>
  );
});

const IsbnGridLevel: React.FC<{
  store: Store;
  zoomLevel: number;
  thickness: number;
  z: number;
  color: string;
}> = observer(function IsbnGridLevel(props) {
  const { store } = props;

  const thickness = props.zoomLevel > 4 ? props.thickness + 1 : props.thickness;
  const pwidth = store.projection.pixelWidth;
  const pheight = store.projection.pixelHeight;

  const outerGridWidth = 10;
  const outerGridHeight = totalIsbns / 1e9;
  const width = outerGridWidth * 10 ** Math.floor(props.zoomLevel / 2);
  const height = outerGridHeight * 10 ** Math.floor((props.zoomLevel + 1) / 2);

  let innerOnly = 1;
  if (props.zoomLevel > 5) {
    innerOnly = 100;
  }
  const { position } = useLocalObservable(
    () => ({
      get position() {
        let position: [number, number, number] = [
          store.projection.pixelWidth / 2,
          -store.projection.pixelHeight / 2,
          props.z,
        ];
        if (props.zoomLevel > 5) {
          position = [
            store.view.minX + store.view.width / 2,
            -(store.view.minY + store.view.height / 2),
            props.z,
          ];
          position[0] -= position[0] % (pwidth / width);
          position[1] -= position[1] % (pheight / height);
        }
        return position;
      },
    }),
    { position: computed.struct }
  );
  return (
    <Grid
      args={[width / innerOnly, height / innerOnly]}
      cellSize={0}
      sectionColor={props.color}
      sectionThickness={thickness}
      sectionSize={1}
      scale={[pwidth / width, 1, pheight / height]}
      position={position}
      rotation={[Math.PI / 2, 0, 0]}
      fadeDistance={1000}
      // cellThickness={2}
    />
  );
});
