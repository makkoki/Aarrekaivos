import { GridPosition, Tile } from './TileTypes';

export type LevelState = {
  grid: Tile[][];
  player: GridPosition;
  enemies: GridPosition[];
  width: number;
  height: number;
  totalCrystals: number;
  requiredCrystals: number;
  exitOpen: boolean;
};

const symbols = new Set<string>(Object.values(Tile));

export function parseLevel(rows: string[], requiredCrystals: number): LevelState {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const grid: Tile[][] = [];
  const enemies: GridPosition[] = [];
  let player: GridPosition | null = null;
  let totalCrystals = 0;

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error('Kaikkien kenttärivien täytyy olla saman pituisia.');
    }

    const tiles: Tile[] = [];
    [...row].forEach((symbol, x) => {
      if (symbol === 'P') {
        player = { x, y };
        tiles.push(Tile.Empty);
        return;
      }

      if (symbol === 'E') {
        enemies.push({ x, y });
        tiles.push(Tile.Empty);
        return;
      }

      if (!symbols.has(symbol)) {
        throw new Error(`Tuntematon kenttämerkki "${symbol}" kohdassa ${x},${y}.`);
      }

      const tile = symbol as Tile;
      if (tile === Tile.Crystal) {
        totalCrystals += 1;
      }
      tiles.push(tile);
    });
    grid.push(tiles);
  });

  if (!player) {
    throw new Error('Kentästä puuttuu pelaajan aloituspaikka P.');
  }

  return {
    grid,
    player,
    enemies,
    width,
    height,
    totalCrystals,
    requiredCrystals: Math.min(requiredCrystals, totalCrystals),
    exitOpen: false,
  };
}

export function clonePosition(position: GridPosition): GridPosition {
  return { x: position.x, y: position.y };
}
