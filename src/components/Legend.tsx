import { observer } from "mobx-react-lite";
import Select, {
  components,
  OptionProps,
  SingleValueProps,
} from "react-select";
import { defaultColorSchemeMeaning } from "../config";
import { Store } from "../lib/Store";
export const gradientsPngUrl = new URL(
  "../assets/gradients.png",
  import.meta.url,
).toString();
const w = 230;
const h = 20;
const totalGradientsInPng = 9;
const options = Array.from({ length: totalGradientsInPng })
  .map((_, value) => ({
    value,
  }))
  .filter((e) => e.value !== 1);

export const Legend: React.FC<{ store: Store }> = observer(
  function Legend(props) {
    const dataset = props.store.currentDataset;
    let meaning = dataset.colorSchemeMeaning;
    if (meaning === null) return;
    meaning ??= defaultColorSchemeMeaning;

    return (
      <div>
        <Select<{ value: number }>
          isSearchable={false}
          value={options.find(
            (o) => o.value === props.store.runtimeConfig.colorGradient,
          )}
          getOptionValue={(e) => e.value.toString()}
          onChange={(e) => {
            if (e) props.store.runtimeConfig.colorGradient = e.value;
          }}
          options={options}
          components={{
            Option: ColorGradientOption,
            SingleValue: ColorGradientSingleValue,
          }}
          store={props.store}
        />
      </div>
    );
  },
);

const ColorGradientOption: React.FC<OptionProps<{ value: number }>> = (p) => {
  return (
    <components.Option {...p}>
      <Gradient value={p.data.value} />
    </components.Option>
  );
};

const ColorGradientSingleValue: React.FC<SingleValueProps<{ value: number }>> =
  observer((p) => {
    const meaning =
      p.selectProps.store.currentDataset.colorSchemeMeaning ??
      defaultColorSchemeMeaning;
    return (
      <components.SingleValue {...p}>
        {/* <div style={{ textAlign: "center" }}>Legend</div> */}
        <div style={{ position: "relative", marginLeft: "2.2em" }}>
          <Gradient value={p.data.value} />
          {meaning.markers.map((m) => (
            <div
              key={m.value}
              style={{
                left: w * m.value,
                top: 0,
                position: "absolute",
                transform: "translate(-50%, 0)",
              }}
            >
              <div
                style={{
                  width: 0,
                  borderLeft: "1px solid black",
                  height: h,
                  marginLeft: "50%",
                }}
              />
              {m.label}
            </div>
          ))}
          <div style={{ height: "1.5em" }} />
        </div>
      </components.SingleValue>
    );
  });

const Gradient: React.FC<{ value: number }> = (props) => (
  <div
    style={{
      backgroundImage: `url(${gradientsPngUrl})`,
      width: w,
      height: h,
      backgroundPosition: `0px ${-1 * 20 * props.value}px`,
      backgroundSize: `${w}px ${h * totalGradientsInPng}px`,
    }}
  />
);
