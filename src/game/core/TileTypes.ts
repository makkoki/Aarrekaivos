export const TILE_SIZE = 32;

export enum Tile {
  Empty = ' ',
  Dirt = '.',
  Wall = '#',
  Crystal = 'C',
  Rock = 'R',
  Exit = 'X',
}

export type Direction = {
  x: number;
  y: number;
};

export type GridPosition = {
  x: number;
  y: number;
};

export const DIRECTIONS: Direction[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
