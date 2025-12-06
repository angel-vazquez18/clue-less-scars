import React, { useMemo } from "react";

const BOARD_SIZE = 15;

const CHARACTER_COLORS = {
  "Miss Scarlet": "#dc143c",
  "Professor Plum": "#811381",
  "Colonel Mustard": "#ffd700",
  "Mrs. Peacock": "#0e7cbc",
  "Mr. Green": "#1ca81c",
  "Mrs. White": "#f7f7f7",
};

const ROOM_COLORS = {
  Study: "#d1b48c",
  Hall: "#f3d9a6",
  Lounge: "#d69ba2",
  Library: "#a1b8c8",
  "Billiard Room": "#8ab17d",
  "Dining Room": "#c9a46c",
  Conservatory: "#7fb8ad",
  Ballroom: "#a1a4d6",
  Kitchen: "#c1d18a",
};

const createBoardLayout = () => {
  const layout = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      type: "void",
      id: null,
      label: "",
      secret: false,
    }))
  );

  const fillRegion = (
    rowStart,
    colStart,
    height,
    width,
    { id, type, label, secret }
  ) => {
    const midRow = rowStart + Math.floor(height / 2);
    const midCol = colStart + Math.floor(width / 2);
    for (let r = rowStart; r < rowStart + height; r++) {
      for (let c = colStart; c < colStart + width; c++) {
        layout[r][c] = {
          type,
          id,
          label: r === midRow && c === midCol ? label || id : "",
          secret: !!secret && r === rowStart && c === colStart,
        };
      }
    }
  };

  const fillWalkway = (rowStart, colStart, height, width, id, label) => {
    fillRegion(rowStart, colStart, height, width, {
      id,
      type: "hallway",
      label,
    });
  };

  // Rooms
  fillRegion(0, 0, 5, 5, {
    id: "Study",
    type: "room",
    label: "Study",
    secret: true,
  });
  fillRegion(0, 6, 5, 3, { id: "Hall", type: "room", label: "Hall" });
  fillRegion(0, 10, 5, 5, {
    id: "Lounge",
    type: "room",
    label: "Lounge",
    secret: true,
  });
  fillRegion(6, 0, 5, 5, { id: "Library", type: "room", label: "Library" });
  fillRegion(6, 6, 5, 3, {
    id: "Billiard Room",
    type: "room",
    label: "Billiard",
  });
  fillRegion(6, 10, 5, 5, { id: "Dining Room", type: "room", label: "Dining" });
  fillRegion(11, 0, 4, 5, {
    id: "Conservatory",
    type: "room",
    label: "Conservatory",
    secret: true,
  });
  fillRegion(11, 6, 4, 3, { id: "Ballroom", type: "room", label: "Ballroom" });
  fillRegion(11, 10, 4, 5, {
    id: "Kitchen",
    type: "room",
    label: "Kitchen",
    secret: true,
  });

  // Hallways (H1-H6 horizontal connectors)
  fillWalkway(0, 5, 1, 2, "H1", "H1");
  fillWalkway(0, 9, 1, 2, "H2", "H2");
  fillWalkway(6, 5, 1, 2, "H3", "H3");
  fillWalkway(6, 9, 1, 2, "H4", "H4");
  fillWalkway(11, 5, 1, 2, "H5", "H5");
  fillWalkway(11, 9, 1, 2, "H6", "H6");

  // Hallways (V1-V6 vertical connectors)
  fillWalkway(5, 0, 2, 1, "V1", "V1");
  fillWalkway(5, 6, 2, 1, "V2", "V2");
  fillWalkway(5, 10, 2, 1, "V3", "V3");
  fillWalkway(10, 0, 2, 1, "V4", "V4");
  fillWalkway(10, 6, 2, 1, "V5", "V5");
  fillWalkway(10, 10, 2, 1, "V6", "V6");

  return layout;
};

const BOARD_LAYOUT = createBoardLayout();

const cellPositions = BOARD_LAYOUT.reduce((acc, row, rowIndex) => {
  row.forEach((cell, colIndex) => {
    if (cell && cell.id && !acc[cell.id]) {
      acc[cell.id] = { row: rowIndex, col: colIndex };
    }
  });
  return acc;
}, {});

const getPlayerCellId = (player, startingPositions) => {
  if (player.position?.id) return player.position.id;
  return startingPositions[player.characterId] || null;
};

const BoardGrid = ({ startingPositions, gameState }) => {
  const playersByCell = useMemo(() => {
    const playersWithCharacters = (gameState.players || []).filter(
      (p) => p.characterId
    );
    return playersWithCharacters.reduce((acc, player) => {
      const cellId = getPlayerCellId(player, startingPositions);
      if (!cellId || !cellPositions[cellId]) return acc;
      if (!acc[cellId]) acc[cellId] = [];
      acc[cellId].push(player);
      return acc;
    }, {});
  }, [gameState.players, startingPositions]);

  const weaponsByCell = useMemo(() => {
    return Object.entries(gameState.board?.weaponTokens || {}).reduce(
      (acc, [weaponId, locationId]) => {
        if (!locationId || !cellPositions[locationId]) return acc;
        if (!acc[locationId]) acc[locationId] = [];
        acc[locationId].push(weaponId);
        return acc;
      },
      {}
    );
  }, [gameState.board?.weaponTokens]);

  return (
    <div className="board-wrapper">
      <div
        className="board-grid"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(32px, 1fr))`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(32px, 1fr))`,
        }}>
        {BOARD_LAYOUT.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            if (!cell || cell.type === "void") {
              return (
                <div
                  key={`void-${rowIndex}-${colIndex}`}
                  className="board-cell void"
                />
              );
            }

            const playersHere = playersByCell[cell.id] || [];
            const weaponsHere = weaponsByCell[cell.id] || [];
            const roomColor =
              cell.type === "room" ? ROOM_COLORS[cell.id] || "#d7ccc8" : null;

            return (
              <div
                key={`${cell.id}-${rowIndex}-${colIndex}`}
                className={`board-cell ${cell.type}`}
                data-cell-id={cell.id}
                style={{
                  backgroundColor:
                    cell.type === "room"
                      ? roomColor
                      : cell.type === "hallway"
                      ? "rgba(214, 188, 150, 0.5)"
                      : undefined,
                }}>
                {cell.label && <div className="cell-label">{cell.label}</div>}
                {cell.secret && (
                  <div className="cell-secret" title="Secret Passage">
                    ★
                  </div>
                )}
                <div className="cell-tokens">
                  {playersHere.map((player) => {
                    const color =
                      CHARACTER_COLORS[player.characterId] || "#4a5568";
                    return (
                      <span
                        key={player.id}
                        className="token token-player"
                        style={{ backgroundColor: color }}
                        title={`${player.characterId} (${player.name})`}
                      />
                    );
                  })}
                  {weaponsHere.map((weaponId) => (
                    <span
                      key={weaponId}
                      className="token token-weapon"
                      title={weaponId.replace(/^weapon:/, "")}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BoardGrid;
