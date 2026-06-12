import { getTile, hasEntityAt } from './Grid';
import { DIRECTIONS, GridPosition, Tile } from './TileTypes';

export function chooseEnemyMove(
  enemy: GridPosition,
  player: GridPosition,
  grid: Tile[][],
  enemies: GridPosition[],
): GridPosition {
  const orderedDirections = [...DIRECTIONS].sort((a, b) => {
    const distanceA = Math.abs(enemy.x + a.x - player.x) + Math.abs(enemy.y + a.y - player.y);
    const distanceB = Math.abs(enemy.x + b.x - player.x) + Math.abs(enemy.y + b.y - player.y);
    return distanceA - distanceB;
  });

  const friendlyRandomness = Math.random() < 0.35;
  const directions = friendlyRandomness ? [...orderedDirections].reverse() : orderedDirections;

  for (const direction of directions) {
    const next = { x: enemy.x + direction.x, y: enemy.y + direction.y };
    const tile = getTile(grid, next);
    const occupiedByEnemy = hasEntityAt(
      enemies.filter((candidate) => candidate !== enemy),
      next,
    );

    if ((tile === Tile.Empty || tile === Tile.Dirt || tile === Tile.Crystal) && !occupiedByEnemy) {
      return next;
    }
  }

  return enemy;
}
