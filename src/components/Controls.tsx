import isbnlib from "isbn3";
import { observer, useLocalObservable } from "mobx-react-lite";
import { fromPromise } from "mobx-utils";
import React, { useMemo, useRef } from "react";
import { OptionProps, components } from "react-select";
import AsyncSelect from "react-select/async";
import Select from "react-select/base";
import { default as config, default as staticConfig } from "../config";
import { GoogleBooksItem, googleBooksQuery } from "../lib/google-books";
import { Store } from "../lib/Store";
import { IsbnPrefixWithoutDashes, IsbnStrWithChecksum } from "../lib/util";
import { Legend } from "./Legend";

export const Controls: React.FC<{ store: Store }> = observer(function Controls({
  store,
}) {
  const state = useLocalObservable(() => ({
    showSettings: false,
    showDatasetChooser: false,
  }));
  const stats = useMemo(
    () =>
      fromPromise(
        store.statsCalculator.getStats(
          "978" as IsbnPrefixWithoutDashes,
          "979" as IsbnPrefixWithoutDashes
        )
      ),
    []
  );
  return (
    <div className={`controls ${state.showSettings ? "advanced" : ""}`}>
      <div className="head">
        <b style={{ fontSize: "120%" }}>ISBN Visualization</b>{" "}
        {stats.case({
          fulfilled(stats) {
            return (
              <small style={{ alignSelf: "flex-end" }}>
                Showing{" "}
                {(
                  stats[`dataset_${store.runtimeConfig.dataset}`] ??
                  stats.dataset_all ??
                  0
                ).toLocaleString()}{" "}
                books
              </small>
            );
          },
        })}
        {state.showSettings && (
          <>
            <button onClick={() => (state.showSettings = !state.showSettings)}>
              <small>⚙ {state.showSettings ? "Done" : "Advanced"}</small>
            </button>

            <button
              onClick={() =>
                store.switchDataset(store.runtimeConfig.dataset, true)
              }
            >
              Reset Settings
            </button>
          </>
        )}
        {!state.showSettings && (
          <button
            className="preset"
            onClick={() => (state.showDatasetChooser = true)}
          >
            <LoadProgress store={store} /> Preset:{" "}
            {(() => {
              const ds = staticConfig.datasetOptions.find(
                (e) => e.id === store.runtimeConfig.dataset
              );
              if (!ds) return null;
              return (
                <>
                  <b>{ds.name}</b>
                  <br />
                  <i>{ds.description}</i>
                </>
              );
            })()}
          </button>
        )}
      </div>
      <Legend store={store} />
      {state.showSettings ? (
        <Settings store={store} />
      ) : (
        <MainStuff store={store} />
      )}
      {state.showDatasetChooser && (
        <div className="dataset-chooser-wrap">
          <div className="dataset-chooser">
            <h4
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: "0.5ex",
              }}
            >
              <div>
                Choose a Preset{" "}
                <button
                  onClick={() => {
                    state.showSettings = !state.showSettings;
                    state.showDatasetChooser = false;
                  }}
                >
                  <small>⚙ {state.showSettings ? "Done" : "Advanced"}</small>
                </button>
              </div>

              <button
                onClick={() => {
                  state.showDatasetChooser = false;
                }}
              >
                <small>Close</small>
              </button>
            </h4>
            {staticConfig.datasetOptions.map((d) => (
              <React.Fragment key={d.id}>
                <button
                  className="choose-dataset"
                  onClick={() => {
                    state.showDatasetChooser = false;
                    store.switchDataset(d.id, true);
                  }}
                >
                  <b>{d.name}</b> [{d.id}]<br />
                  {d.description && <i>{d.description}</i>}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const BookOption: React.FC<OptionProps<MinimalGoogleBooksItem>> = (p) => {
  return (
    <components.Option {...p}>
      <b>{p.data.volumeInfo.title}</b>
      <br />
      {p.data.volumeInfo.authors?.join(", ")}
    </components.Option>
  );
};

export type MinimalGoogleBooksItem = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    industryIdentifiers?: GoogleBooksItem["volumeInfo"]["industryIdentifiers"];
  };
};
const MainStuff: React.FC<{ store: Store }> = observer(function MainStuff({
  store,
}) {
  const selectRef = useRef<Select<MinimalGoogleBooksItem>>(null);
  return (
    <>
      <p>
        Drag/Zoom like a map. Tap to show details of an ISBN! Right-click-drag
        to show stats.
      </p>
      <label className="form-row">
        <div>Show publisher details:</div>
        <input
          type="checkbox"
          checked={store.runtimeConfig.showPublisherNames}
          onChange={(e) => {
            store.runtimeConfig.showPublisherNames = e.currentTarget.checked;
            store.runtimeConfig.publishersBrightness = e.currentTarget.checked
              ? 0.5
              : 0.01;
          }}
        />
      </label>
      <p />
      <label>
        Search for a book via Google Books or ISBN:
        <AsyncSelect<MinimalGoogleBooksItem>
          store={store}
          ref={selectRef}
          loadOptions={async (e) => {
            // if it's an isbn with 13 digits and maybe spaces, use that
            const eAsNum = e.replace(/[^0-9]/g, "");
            if (eAsNum.length === 13) {
              return [
                {
                  id: `isbn-${e}`,
                  volumeInfo: {
                    title: isbnlib.hyphenate(eAsNum) ?? eAsNum,
                    authors: ["Go to ISBN"],
                    industryIdentifiers: [
                      {
                        type: "ISBN_13",
                        identifier: eAsNum as IsbnStrWithChecksum,
                      },
                    ],
                  },
                },
              ];
            }
            const options = await googleBooksQuery(e);
            return options.filter(
              (e) =>
                e.volumeInfo.title &&
                e.volumeInfo.industryIdentifiers?.some(
                  (i) => i.type === "ISBN_13"
                )
            );
          }}
          defaultOptions={config.exampleBooks}
          placeholder="Click for examples..."
          getOptionLabel={(e) => e.volumeInfo.title ?? "?"}
          getOptionValue={(e) => e.id}
          // blurInputOnSelect={true} not working
          onChange={(e) => {
            console.log("found book", e);
            const isbn13 = e?.volumeInfo.industryIdentifiers?.find(
              (i) => i.type === "ISBN_13"
            )?.identifier;
            if (!isbn13) throw Error("no isbn13");
            store.updateHighlightedIsbn(isbn13);
            store.zoomAnimateToHighlight();
            setTimeout(() => {
              // hack to hide keyboard on mobile
              selectRef.current?.blur();
              selectRef.current?.blurInput();
            }, 100);
          }}
          components={{ Option: BookOption }}
        />
      </label>
    </>
  );
});

const Settings: React.FC<{ store: Store }> = observer(function Settings({
  store,
}) {
  const config = store.runtimeConfig;
  return (
    <>
      <fieldset>
        <label className="form-row">
          <div>Dataset:</div>
          <select
            value={config.dataset}
            onChange={(e) => (config.dataset = e.currentTarget.value)}
            style={{ maxWidth: "200px" }}
          >
            {staticConfig.datasetOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} [{d.id}]
              </option>
            ))}
          </select>
        </label>
        <label className="form-row">
          <div>Group text vertical:</div>
          <input
            type="checkbox"
            checked={config.groupTextVertical}
            onChange={(e) =>
              (config.groupTextVertical = e.currentTarget.checked)
            }
          />
        </label>
        <label className="form-row">
          <div>Show grid:</div>
          <input
            type="checkbox"
            checked={config.showGrid}
            onChange={(e) => (config.showGrid = e.currentTarget.checked)}
          />
        </label>
        <label className="form-row">
          <div>Grid color:</div>
          <input
            type="text"
            value={config.gridColor}
            onChange={(e) => (config.gridColor = e.currentTarget.value)}
          />
        </label>
        <label className="form-row">
          <div>Glow brightness:</div>
          <input
            type="range"
            value={config.shaderGlow}
            min={0}
            max={10}
            onChange={(e) => (config.shaderGlow = +e.currentTarget.value)}
          />
        </label>
        <small>(to make it easier to see sparse data)</small>
      </fieldset>
      <fieldset>
        <legend>Publisher settings</legend>
        <label className="form-row">
          <div>Overlay publisher names:</div>
          <input
            type="checkbox"
            checked={config.showPublisherNames}
            onChange={(e) =>
              (config.showPublisherNames = e.currentTarget.checked)
            }
          />
        </label>
        <label className="form-row">
          <div>Color publisher ranges:</div>
          <input
            type="checkbox"
            checked={config.publishersBrightness > 0}
            onChange={(e) =>
              (config.publishersBrightness = e.currentTarget.checked ? 0.7 : 0)
            }
          />
        </label>
        <label className="form-row">
          <div>Publisher ranges brightness:</div>
          <input
            type="range"
            value={config.publishersBrightness}
            min={0}
            max={1}
            step={0.01}
            onChange={(e) =>
              (config.publishersBrightness = +e.currentTarget.value)
            }
          />
        </label>
        <small>
          (each publisher's range is highlighted with a random color)
        </small>

        <label className="form-row">
          <div>Publisher range colors:</div>
          <select
            value={config.publishersColorSchema}
            onChange={(e) =>
              (config.publishersColorSchema = e.currentTarget.value as
                | "dark"
                | "hsl")
            }
          >
            {[
              { id: "hsl", name: "colorful" },
              { id: "dark", name: "brown-blue" },
            ].map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} [{d.id}]
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>Zoom Settings</legend>
        <label className="form-row">
          <div>Min zoom level for text:</div>
          <div>{config.textMinZoomLevel}</div>
          <input
            type="range"
            value={config.textMinZoomLevel}
            min={0.04}
            max={0.2}
            step={0.01}
            onChange={(e) => (config.textMinZoomLevel = +e.currentTarget.value)}
          />
        </label>
        <label className="form-row">
          <div>Text levels to show</div>
          <div>{config.textLevelCount}</div>
          <input
            type="range"
            value={config.textLevelCount}
            min={1}
            max={4}
            step={0.01}
            onChange={(e) => (config.textLevelCount = +e.currentTarget.value)}
          />
        </label>
        <label className="form-row">
          <div>Min zoom level to switch images:</div>
          <div>{config.imgMinZoomLevel}</div>
          <input
            type="range"
            value={config.imgMinZoomLevel}
            min={0.9}
            max={2.0}
            step={0.01}
            onChange={(e) => (config.imgMinZoomLevel = +e.currentTarget.value)}
          />
        </label>
        <label className="form-row">
          <div>Bookshelf styling on zoom:</div>
          <input
            type="checkbox"
            checked={config.doBookshelfEffect}
            onChange={(e) =>
              (config.doBookshelfEffect = e.currentTarget.checked)
            }
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Data Filters</legend>
        <label className="form-row">
          <div>Minimum Publication Year:</div>
          <div>
            {config.filterMinimumPublicationYear === -1
              ? "Off"
              : config.filterMinimumPublicationYear}
          </div>
          <input
            type="range"
            min={1900}
            max={2030}
            value={
              config.filterMinimumPublicationYear === -1
                ? 1900
                : config.filterMinimumPublicationYear
            }
            onChange={(e) => {
              const value = +e.currentTarget.value;
              config.filterMinimumPublicationYear = value === 1900 ? -1 : value;
            }}
          />
        </label>
        <label className="form-row">
          <div>Maximum Publication Year:</div>
          <div>
            {config.filterMaximumPublicationYear === -1
              ? "Off"
              : config.filterMaximumPublicationYear}
          </div>
          <input
            type="range"
            min={1900}
            max={2030}
            value={
              config.filterMaximumPublicationYear === -1
                ? 2030
                : config.filterMaximumPublicationYear
            }
            onChange={(e) => {
              const value = +e.currentTarget.value;
              config.filterMaximumPublicationYear = value === 2030 ? -1 : value;
            }}
          />
        </label>
      </fieldset>
      <label className="form-row">
        <div>Custom shader:</div>
        <input
          type="checkbox"
          checked={!!config.customShader}
          onChange={(e) => {
            if (e.currentTarget.checked) {
              config.customShader = store.shaderUtil.shaderColorFn;
            } else {
              config.customShader = "";
            }
          }}
        />
      </label>
      <textarea
        value={config.customShader || store.shaderUtil.shaderColorFn}
        style={{ height: "8em", width: "100%" }}
        onChange={(e) => {
          store.shaderError = "";
          config.customShader = e.currentTarget.value;
        }}
      />
      {store.shaderError && (
        <div>
          Shader Error:{" "}
          <pre
            style={{
              maxHeight: "300px",
              overflowY: "scroll",
              border: "1px solid black",
            }}
          >
            {store.shaderError}
          </pre>
        </div>
      )}
    </>
  );
});

const LoadProgress = observer(function LoadProgress({
  store,
}: {
  store: Store;
}) {
  if (store.inProgress.size === 0) return /* green checkmark emoji */ "✅";
  const errors = [...store.inProgress].filter((e) => e[1]);
  /* red cross emoji */
  if (errors.length > 0)
    return errors.map((e, i) => (
      <div key={i}>
        ❌ {e[0]}: {String(e[1])}
      </div>
    ));
  return <div className="lds-dual-ring" style={{ height: "1em" }} />;
});
