import React, { useMemo } from "react";
import boardConfigData from "../data/boardConfig.json";
import "./ClueLessBoard.css";

const CHARACTER_COLORS = {
  "Miss Scarlet": "#dc143c",
  "Professor Plum": "#811381",
  "Colonel Mustard": "#ffd700",
  "Mrs. Peacock": "#0e7cbc",
  "Mr. Green": "#1ca81c",
  "Mrs. White": "#f7f7f7",
};

const SUSPECT_ID_TO_CHARACTER = {
  "suspect:scarlet": "Miss Scarlet",
  "suspect:mustard": "Colonel Mustard",
  "suspect:white": "Mrs. White",
  "suspect:green": "Mr. Green",
  "suspect:peacock": "Mrs. Peacock",
  "suspect:plum": "Professor Plum",
};



const classNames = (...values) =>
  values
    .flat()
    .filter(Boolean)
    .join(" ");

const DEFAULT_BOARD_CONFIG = boardConfigData;

const getPlayerCellId = (player, startingPositions) => {
  if (player.position?.id) return player.position.id;
  return startingPositions?.[player.characterId] || null;
};

const normalizeCells = (cells = []) =>
  cells.map((cell) => ({
    label: cell.label ?? (cell.type === "room" ? cell.id : ""),
    width: cell.width ?? 1,
    height: cell.height ?? 1,
    ...cell,
  }));

const registerCell = (cell, occupancy) => {
  const { x, y, width, height } = cell;
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      occupancy.set(`${x + dx}:${y + dy}`, cell);
    }
  }
};

const orientationClass = (cell) => {
  if (cell.type !== "hallway") return null;
  if (cell.id.startsWith("H")) return "vertical";
  if (cell.id.startsWith("V")) return "horizontal";
  if (cell.width === cell.height) return "point";
  return cell.width > cell.height ? "horizontal" : "vertical";
};

const ClueLessBoard = ({
  boardConfig = DEFAULT_BOARD_CONFIG,
  gameState,
  startingPositions,
}) => {
  const {
    cells: rawCells = [],
    secretPassages = [],
    roomDoors = [],
    gridSize,
  } = boardConfig ?? {};

  const normalizedCells = useMemo(() => normalizeCells(rawCells), [rawCells]);

  const boardMetrics = useMemo(() => {
    if (normalizedCells.length === 0) {
      return {
        columns: 0,
        rows: 0,
        cells: [],
        occupancy: new Map(),
      };
    }

    const occupancy = new Map();
    let maxColumn = 0;
    let maxRow = 0;

    normalizedCells.forEach((cell) => {
      registerCell(cell, occupancy);
      maxColumn = Math.max(maxColumn, cell.x + cell.width);
      maxRow = Math.max(maxRow, cell.y + cell.height);
    });

    const targetColumns = gridSize?.columns ?? maxColumn;
    const targetRows = gridSize?.rows ?? maxRow;

    const augmentedCells = [...normalizedCells];

    for (let y = 0; y < targetRows; y += 1) {
      for (let x = 0; x < targetColumns; x += 1) {
        const key = `${x}:${y}`;
        if (!occupancy.has(key)) {
          const voidCell = {
            id: `void-${x}-${y}`,
            type: "void",
            label: "",
            x,
            y,
            width: 1,
            height: 1,
          };
          augmentedCells.push(voidCell);
          registerCell(voidCell, occupancy);
        }
      }
    }

    return {
      columns: targetColumns,
      rows: targetRows,
      cells: augmentedCells,
      occupancy,
    };
  }, [normalizedCells, gridSize?.columns, gridSize?.rows]);

  const secretLookup = useMemo(() => {
    const map = new Map();
    secretPassages.forEach(({ fromId, toId }) => {
      if (fromId && toId) {
        map.set(fromId, toId);
      }
    });
    return map;
  }, [secretPassages]);

  const doorLookup = useMemo(() => {
    const map = new Map();
    roomDoors.forEach(({ roomId, hallwayId, direction }) => {
      if (!roomId || !hallwayId || !direction) return;
      if (!map.has(roomId)) map.set(roomId, []);
      map.get(roomId).push({ hallwayId, direction });
    });
    return map;
  }, [roomDoors]);

  const playersByCell = useMemo(() => {
    if (!gameState?.players?.length) return new Map();
    const grouped = new Map();
    gameState.players
      .filter((player) => player.characterId)
      .forEach((player) => {
        const cellId = getPlayerCellId(player, startingPositions);
        if (!cellId) return;
        if (!grouped.has(cellId)) grouped.set(cellId, []);
        grouped.get(cellId).push(player);
      });
    return grouped;
  }, [gameState?.players, startingPositions]);
  const takenCharacters = useMemo(() => {
    const taken = new Set();
    (gameState?.players || []).forEach((player) => {
      if (player.characterId) {
        taken.add(player.characterId);
      }
    });
    return taken;
  }, [gameState?.players]);

  const suspectTokensByCell = useMemo(() => {
    const tokens = gameState?.board?.suspectTokens ?? {};
    const grouped = new Map();

    Object.entries(tokens).forEach(([suspectId, locationId]) => {
      if (!locationId) return;
      const characterName = SUSPECT_ID_TO_CHARACTER[suspectId];
      if (characterName && takenCharacters.has(characterName)) {
        // That suspect is already represented by a player token
        return;
      }
      if (!grouped.has(locationId)) grouped.set(locationId, []);
      grouped.get(locationId).push(suspectId);
    });

    return grouped;
  }, [gameState?.board?.suspectTokens, takenCharacters]);


  const weaponsByCell = useMemo(() => {
    const tokens = gameState?.board?.weaponTokens ?? {};
    const grouped = new Map();
    Object.entries(tokens).forEach(([weaponId, locationId]) => {
      if (!locationId) return;
      if (!grouped.has(locationId)) grouped.set(locationId, []);
      grouped.get(locationId).push(weaponId);
    });
    return grouped;
  }, [gameState?.board?.weaponTokens]);

  // Board now fills available space via CSS, no need for manual sizing

  if (!boardMetrics.columns || !boardMetrics.rows) {
    return null;
  }

  return (
    <div
      className="cl-board-tabletop"
      role="region"
      aria-label="Clue-Less game board"
    >
      <div 
        className="cl-board-container"
      >
        <div
          className="cl-board-grid"
          role="grid"
          aria-label="Rooms and hallways"
          style={{
            "--cl-columns": boardMetrics.columns,
            "--cl-rows": boardMetrics.rows,
            gridTemplateColumns: `repeat(${boardMetrics.columns}, 1fr)`,
            gridTemplateRows: `repeat(${boardMetrics.rows}, 1fr)`,
          }}
        >
          {boardMetrics.cells.map((cell) => {
            const spanX = cell.width ?? 1;
            const spanY = cell.height ?? 1;
            const secretTarget = secretLookup.get(cell.id);
            const doorEntries = doorLookup.get(cell.id) ?? [];
            const cellPlayers = playersByCell.get(cell.id) ?? [];
            const cellSuspects = suspectTokensByCell.get(cell.id) ?? [];
            const cellWeapons = weaponsByCell.get(cell.id) ?? [];
            const cellOrientation = orientationClass(cell);

            return (
              <div
                key={cell.id}
                id={`cell-${cell.id}`}
                data-cell-type={cell.type}
                className={classNames(
                  "cl-cell",
                  `cl-cell-${cell.type}`,
                  cell.type === "room" && "cl-cell-room",
                  cell.type === "hallway" && [
                    "cl-cell-hallway",
                    cellOrientation && `cl-cell-hallway--${cellOrientation}`,
                  ],
                  cell.type === "void" && "cl-cell-void"
                )}
                style={{
                  gridColumn: `${cell.x + 1} / span ${spanX}`,
                  gridRow: `${cell.y + 1} / span ${spanY}`,
                }}
                role="gridcell"
                aria-label={
                  cell.label
                    ? `${cell.label}${
                        cellPlayers.length || cellWeapons.length
                          ? `, ${cellPlayers.length} player(s), ${cellWeapons.length} weapon(s)`
                          : ""
                      }`
                    : cell.id
                }
                data-secret-to={secretTarget || undefined}
              >
                {doorEntries.map(({ direction, hallwayId }) => (
                  <span
                    key={`${hallwayId}-${direction}`}
                    className={`cl-door cl-door-${direction}`}
                    data-door-to={hallwayId}
                    aria-hidden="true"
                  />
                ))}

                <div className="cl-cell-surface">
                  {cell.type === "room" && (
                    <div className="cl-room-label" title={cell.label}>
                      {cell.label}
                    </div>
                  )}

                  {cell.type === "hallway" && cell.label && (
                    <div className="cl-hallway-label">{cell.label}</div>
                  )}

                  {secretTarget && (
                    <span
                      className="cl-secret-marker"
                      title={`Secret passage to ${secretTarget}`}
                    >
                      SP
                    </span>
                  )}

                  {(cellPlayers.length > 0 || cellWeapons.length > 0) && (
                    <div className="cl-token-stack">
                      {cellPlayers.map((player) => (
                        <span
                          key={player.id}
                          className="cl-token cl-token-player"
                          title={`${player.characterId} (${player.name})`}
                          style={{
                            backgroundColor:
                              CHARACTER_COLORS[player.characterId] || "#4a5568",
                          }}
                        />
                      ))}
                      {cellSuspects.map((suspectId) => {
                        const characterName =
                          SUSPECT_ID_TO_CHARACTER[suspectId] ||
                          suspectId.replace(/^suspect:/, "");
                        return (
                          <span
                            key={suspectId}
                            className="cl-token cl-token-suspect"
                            title={characterName}
                            style={{
                              backgroundColor:
                                CHARACTER_COLORS[characterName] || "#4a5568",
                            }}
                          />
                        );
                      })}
                      {cellWeapons.map((weaponId) => (
                        <span
                          key={weaponId}
                          className="cl-token cl-token-weapon"
                          title={weaponId.replace(/^weapon:/, "")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const sampleBoardConfig = DEFAULT_BOARD_CONFIG;

export default ClueLessBoard;
