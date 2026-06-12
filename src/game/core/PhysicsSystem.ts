import { getTile, hasEntityAt, samePosition, setTile } from './Grid';
import { GridPosition, Tile } from './TileTypes';

export type GravityResult = {
  crushedPlayer: boolean;
  defeatedEnemyIndexes: number[];
};

export function applyRockGravity(grid: Tile[][], player: GridPosition, enemies: GridPosition[]): GravityResult {
  const defeatedEnemyIndexes = new Set<number>();
  let crushedPlayer = false;

  for (let y = grid.length - 2; y >= 0; y -= 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const rockPosition = { x, y };
      if (getTile(grid, rockPosition) !== Tile.Rock) {
        continue;
      }

      const below = { x, y: y + 1 };
      const belowTile = getTile(grid, below);
      const enemyIndex = enemies.findIndex((enemy) => samePosition(enemy, below));
      const canFallIntoEmpty = belowTile === Tile.Empty && !hasEntityAt(enemies, below) && !samePosition(player, below);
      const canCrushPlayer = belowTile === Tile.Empty && samePosition(player, below);
      const canCrushEnemy = belowTile === Tile.Empty && enemyIndex !== -1;

      if (!canFallIntoEmpty && !canCrushPlayer && !canCrushEnemy) {
        continue;
      }

      setTile(grid, rockPosition, Tile.Empty);
      setTile(grid, below, Tile.Rock);

      if (canCrushPlayer) {
        crushedPlayer = true;
      }
      if (canCrushEnemy) {
        defeatedEnemyIndexes.add(enemyIndex);
      }
    }
  }

  return { crushedPlayer, defeatedEnemyIndexes: [...defeatedEnemyIndexes] };
}
