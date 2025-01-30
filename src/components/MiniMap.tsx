import { Observer, observer } from "mobx-react-lite";
import React, { useState } from "react";
import { Store } from "../lib/Store";
import {
  firstIsbnInPrefix,
  isbnPrefixFromRelative,
  IsbnPrefixRelative,
  lastIsbnInPrefix,
} from "../lib/util";
import { getPlanePosition } from "../lib/view-utils";

// Default blocks configuration
const DEFAULT_BLOCKS = [
  { pos: "00", text: "EN" }, // Row 0, Col 0
  { pos: "01", text: "EN" }, // Row 0, Col 1
  { pos: "02", text: "FR" }, // Row 0, Col 2
  { pos: "03", text: "DE" }, // Row 0, Col 3
  { pos: "04", text: "JP" }, // Row 0, Col 4
  { pos: "05", text: "SU" }, // R1ow 0, Col 5
  { pos: "07", text: "CN" }, // Row 0, Col 7
  { pos: "18", text: "US" }, // Row 1, Col 8
  { pos: "065", text: "BR" },
  // XX blocks for column 6 (prefix '0' for row 0)
  ...Array.from({ length: 4 }, (_, i) => ({
    pos: `06${i}`,
    text: `6${i}`,
  })),
  // XX blocks for column 8 (prefix '0' for row 0)
  ...Array.from({ length: 10 }, (_, i) => ({
    pos: `08${i}`,
    text: ["CS", "IN", "NO", "PL", "ES", "BR", "YU", "DK", "IT", "KR"][i],
  })),
  // XX blocks for column 9 (prefix '0' for row 0)
  ...Array.from({ length: 10 }, (_, i) => ({
    pos: `09${i}`,
    text: ["NL", "SE", "", "IN", "NL"][i] ?? `9${i}`,
  })),
  { pos: "110", text: "FR" },
  { pos: "111", text: "KR" },
  { pos: "112", text: "IT" },
  { pos: "113", text: "ES" },
];

interface Overlay {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BlockConfig {
  pos: string; // Two digits (row/col) for main blocks, four digits (row/col/subdivision) for XX
  text: string;
  color?: string;
}

type CellType = "main" | "xx" | "us";

interface BlockClickEvent {
  pos: IsbnPrefixRelative;
  text: string;
}

interface MinimapSVGProps {
  blocks?: BlockConfig[];
  onCellClick?: (event: BlockClickEvent) => void;
  store: Store;
}

const MinimapSVG: React.FC<MinimapSVGProps> = ({
  blocks = DEFAULT_BLOCKS,
  onCellClick,
  store,
}) => {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // Constants
  const SQRT10 = Math.sqrt(10);
  const WIDTH = 100;
  const HEIGHT = WIDTH * (2 / SQRT10);
  const ROW_HEIGHT = HEIGHT / 2;
  const CELL_WIDTH = WIDTH / 10;
  const XX_HEIGHT = ROW_HEIGHT / 10;

  // Helper to parse position string
  const parsePosition = (pos: string) => {
    if (pos.length === 2) {
      // Main block: row/column
      return {
        row: parseInt(pos[0]),
        column: parseInt(pos[1]),
        subdivision: null,
      };
    } else if (pos.length === 3) {
      // XX block: row/column/subdivision
      return {
        row: parseInt(pos[0]),
        column: parseInt(pos[1]),
        subdivision: parseInt(pos.slice(2)),
      };
    }
    throw new Error(
      "Position must be 2 digits for main blocks or 3 digits for XX blocks"
    );
  };

  // Color generation
  const generateColor = (pos: string): string => {
    const { row, column, subdivision } = parsePosition(pos);
    const isXX = subdivision !== null;

    if (isXX) {
      const baseHues: Record<number, number> = {
        6: 180, // Cyan-based
        8: 280, // Purple-based
        9: 30, // Orange-based
      };
      const hue = (baseHues[column] || 0) + subdivision * 10;
      return `hsl(${hue}, 80%, ${60 + subdivision * 2}%)`;
    } else {
      const baseColors: Record<string, string> = {
        "00": "#4a90e2", // EN
        "01": "#4a90e2", // EN
        "02": "#50c878", // FR
        "03": "#daa520", // DE
        "04": "#ff6b6b", // JP
        "05": "#9370db", // RU
        "07": "#ff4500", // CN
        "18": "#4169e1", // US
      };
      return baseColors[pos] || "#808080";
    }
  };

  // Helper to determine if a position represents an XX block
  const isXXBlock = (pos: string): boolean => pos.length === 3;

  // Helper to get block dimensions
  const getBlockDimensions = (pos: string) => {
    const { row, column, subdivision } = parsePosition(pos);

    if (subdivision !== null) {
      return {
        x: column * CELL_WIDTH,
        y: row * ROW_HEIGHT + subdivision * XX_HEIGHT,
        width: CELL_WIDTH,
        height: XX_HEIGHT,
      };
    } else {
      return {
        x: column * CELL_WIDTH,
        y: row * ROW_HEIGHT,
        width: CELL_WIDTH,
        height: ROW_HEIGHT,
      };
    }
  };

  const renderBlock = (block: BlockConfig) => {
    const { pos, text } = block;
    const dims = getBlockDimensions(pos);
    const isHovered = hoveredCell === pos;
    const isXX = isXXBlock(pos);

    return (
      <g
        key={pos}
        onMouseEnter={() => setHoveredCell(pos)}
        onMouseLeave={() => setHoveredCell(null)}
        onClick={() =>
          onCellClick?.({
            pos,
            text,
          })
        }
        style={{ cursor: "pointer" }}
      >
        <rect
          {...dims}
          fill={block.color || generateColor(pos)}
          opacity={isHovered ? 1 : 0.8}
          stroke={isHovered ? "#fff" : isXX ? "#444" : "none"}
          strokeWidth={isHovered ? "0.2" : "0.1"}
        />
        <text
          x={dims.x + dims.width / 2}
          y={dims.y + dims.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={isXX ? 2.5 : 4}
        >
          {text}
        </text>
      </g>
    );
  };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      {/* Background */}
      <rect width={WIDTH} height={HEIGHT} fill="#1a1a1a" />

      {/* Blocks */}
      {blocks.map(renderBlock)}

      {/* Grid lines */}
      <g stroke="#333" strokeWidth="0.25">
        {Array.from({ length: 11 }, (_, i) => (
          <line
            key={`vline-${i}`}
            x1={i * CELL_WIDTH}
            y1={0}
            x2={i * CELL_WIDTH}
            y2={HEIGHT}
          />
        ))}
        {Array.from({ length: 3 }, (_, i) => (
          <line
            key={`hline-${i}`}
            x1={0}
            y1={i * ROW_HEIGHT}
            x2={WIDTH}
            y2={i * ROW_HEIGHT}
          />
        ))}
      </g>

      <Observer>
        {() => {
          const scale = store.projection.pixelWidth / 100;
          const overlay = {
            x: store.view.minX / scale,
            y: store.view.minY / scale,
            width: store.view.width / scale,
            height: store.view.height / scale,
          };
          const widthRatio = overlay.width / WIDTH;
          return (
            <rect
              pointerEvents="none"
              x={overlay.x}
              y={overlay.y}
              rx={5 * widthRatio}
              width={overlay.width}
              height={overlay.height}
              fill={`rgba(255,255,255,${Math.max(
                0,
                Math.min(1, 1 - widthRatio)
              )})`}
              stroke="#fff"
              strokeWidth="0.5"
            />
          );
        }}
      </Observer>
    </svg>
  );
};

/*
      {/* Overlay rectangle 
     
    </svg>
  );
};*/

export const MiniMap: React.FC<{ store: Store }> = observer(function MiniMap(
  props
) {
  return (
    <div className="minimap">
      <MinimapSVG
        store={props.store}
        onCellClick={(e) => {
          const start = firstIsbnInPrefix(isbnPrefixFromRelative(e.pos));
          const end = lastIsbnInPrefix(isbnPrefixFromRelative(e.pos));
          const p = getPlanePosition(props.store.projection, start, end);
          props.store.zoomAnimateTo(
            p.xStart + p.width / 2,
            p.yStart + p.height / 2,
            { 2: 2, 3: 0.9 * Math.sqrt(10) ** 2 }[e.pos.length] ?? 1,
            1
          );
        }}
      />
    </div>
  );
});
