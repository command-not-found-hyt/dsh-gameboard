export const GRID_COLUMNS = 6;
export const GRID_ROWS = 8;

export function slotAt(index: number): { column: number; row: number } {
  return { column: index % GRID_COLUMNS, row: Math.floor(index / GRID_COLUMNS) };
}

export function InventoryGrid(): null {
  return null;
}
