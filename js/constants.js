// --- GAME CONSTANTS & WORLD CONFIGURATION ---
    const TILE_SIZE = 32;
    const GRID_COLS = 16;
    const SURFACE_ROW = 2; // Row 2 and 3 are surface platform

    const BLOCK_TYPES = {
      AIR: 0,
      STEEL_PLATFORM: 1,
      DIRT: 2,
      STONE: 3,
      HARD_STONE: 4,
      DEEPSLATE: 5,
      ORE_GOLD: 6,
      ORE_IRON: 7,
      ORE_COBALT: 8
    };

    const BLOCK_DEFS = {
      [BLOCK_TYPES.AIR]: { name: 'Air', hp: 0, drop: null },
      [BLOCK_TYPES.STEEL_PLATFORM]: { name: 'Steel Platform', hp: Infinity, indestructible: true, drop: null },
      [BLOCK_TYPES.DIRT]: { name: 'Loam Earth', hp: 1, drop: null },
      [BLOCK_TYPES.STONE]: { name: 'Granite Stone', hp: 3, drop: null },
      [BLOCK_TYPES.HARD_STONE]: { name: 'Dense Basalt', hp: 4, drop: null },
      [BLOCK_TYPES.DEEPSLATE]: { name: 'Deepslate', hp: 5, drop: null },
      [BLOCK_TYPES.ORE_GOLD]: { name: 'Gold Vein', hp: 5, drop: 'gold' },
      [BLOCK_TYPES.ORE_IRON]: { name: 'Iron Ore', hp: 6, drop: 'iron' },
      [BLOCK_TYPES.ORE_COBALT]: { name: 'Cobalt Crystal', hp: 8, drop: 'cobalt' }
    };

    // Physical Surface Stations (on Surface Platform row 1)
    const STATIONS = {
      smelter: { x: 2, y: 1, name: 'The Smelter' },
      refuel: { x: 5, y: 1, name: 'Refuel Station' },
      merchant: { x: 12, y: 1, name: 'The Merchant' }
    };

// Node.js test environment export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { TILE_SIZE, GRID_COLS, SURFACE_ROW, BLOCK_TYPES, BLOCK_DEFS, STATIONS };
}
