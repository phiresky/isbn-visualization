import { Plane } from "@react-three/drei";
import { observer, useLocalObservable } from "mobx-react-lite";
import { fromPromise } from "mobx-utils";
import { useEffect, useState } from "react";
import { Blending } from "three";
import { DetailLevelObservable } from "../lib/DetailLevelObservable";
import { Store } from "../lib/Store";
import {
  digits,
  isbnPrefixAppend,
  isbnPrefixToRelative,
  IsbnPrefixWithDashes,
  IsbnPrefixWithoutDashes,
  ProjectionConfig,
  removeDashes,
} from "../lib/util";

export const ImageTree: React.FC<{
  config: ProjectionConfig;
  store: Store;
  prefix: IsbnPrefixWithDashes;
  blending: Blending;
}> = observer(function _ImageTree(props) {
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
  blending: Blending;
}> = observer(function _GroupShowInner({ view, ...props }) {
  const { position, width, height } = view.planePosition;
  const groupPrefix = removeDashes(props.prefix);
  const [hasChildren, setHasChildren] = useState(false);
  useEffect(() => {
    (async () => {
      setHasChildren(
        (
          await Promise.all(
            props.store.shaderUtil.shaderProgram.requiredTextures.map(
              (dataset) =>
                props.store
                  .imageLoader(dataset)
                  .getHasChildren(isbnPrefixToRelative(groupPrefix)),
            ),
          )
        ).some((e) => e),
      );
    })();
  }, [groupPrefix, props.store.shaderUtil.shaderProgram.requiredTextures]);

  return (
    <>
      {view.image && (
        <PrefixImage
          store={props.store}
          prefix={groupPrefix}
          position={[
            position[0],
            position[1],
            position[2] + groupPrefix.length / 10,
          ]}
          args={[width, height]}
          blending={props.blending}
        />
      )}
      {view.imageChildren &&
        hasChildren &&
        digits.map((i) => {
          return (
            <ImageTree
              key={props.prefix + i}
              prefix={isbnPrefixAppend(props.prefix, String(i))}
              config={props.config}
              store={props.store}
              blending={props.blending}
            />
          );
        })}
    </>
  );
});

const PrefixImage: React.FC<{
  store: Store;
  prefix: IsbnPrefixWithoutDashes;
  position: [number, number, number];
  args: [number, number];
  blending: Blending;
}> = observer((props) => {
  const prefix = isbnPrefixToRelative(props.prefix);
  const { material } = useLocalObservable(() => ({
    get _material() {
      return fromPromise(props.store.shaderUtil.getIsbnShaderMaterial(prefix));
    },
    get material() {
      return this._material.case({
        fulfilled: (m) => {
          if (m) {
            m.refreshUniforms();
            return m.material;
          }
        },
      });
    },
  }));
  if (!material) return null;
  return (
    <Plane
      // ref={pl}
      key={material.id} // react threejs does not update material https://github.com/pmndrs/react-three-fiber/issues/2839
      material={material}
      position={props.position}
      args={props.args}
    />
  );
});
