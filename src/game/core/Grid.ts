import { GridPosition, Tile } from './TileTypes';

export function isInside(grid: Tile[][], position: GridPosition): boolean {
  return position.y >= 0 && position.y < grid.length && position.x >= 0 && position.x < (grid[0]?.length ?? 0);
}

export function getTile(grid: Tile[][], position: GridPosition): Tile {
  if (!isInside(grid, position)) {
    return Tile.Wall;
  }

  return grid[position.y][position.x];
}

export function setTile(grid: Tile[][], position: GridPosition, tile: Tile): void {
  if (isInside(grid, position)) {
    grid[position.y][position.x] = tile;
  }
}

export function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function hasEntityAt(entities: GridPosition[], position: GridPosition): boolean {
  return entities.some((entity) => samePosition(entity, position));
}
