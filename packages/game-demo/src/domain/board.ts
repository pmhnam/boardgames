export interface Position {
  row: number;
  col: number;
}

export const BLOCKED = '#blocked';

/** null = empty, BLOCKED = unusable, otherwise the owning player's id. */
export type Cell = null | typeof BLOCKED | string;

export function isInsideBoard(size: number, position: Position): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < size &&
    position.col >= 0 &&
    position.col < size
  );
}

export function toIndex(size: number, position: Position): number {
  return position.row * size + position.col;
}

export function toPosition(size: number, index: number): Position {
  return { row: Math.floor(index / size), col: index % size };
}

export function cellAt(cells: readonly Cell[], size: number, position: Position): Cell {
  return cells[toIndex(size, position)] ?? null;
}

export function orthogonalNeighbours(size: number, position: Position): Position[] {
  return [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
  ].filter((candidate) => isInsideBoard(size, candidate));
}

export function areAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
