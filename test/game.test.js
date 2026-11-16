const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// 1. Setup Mock DOM environment for Node
const c = require('../js/constants.js');
Object.assign(globalThis, c);

const mockElem = {
  textContent: '',
  style: {},
  classList: { add: () => {}, remove: () => {}, contains: () => false },
  addEventListener: () => {},
  getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
  getContext: () => ({
    fillStyle: '',
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    translate: () => {},
    rotate: () => {}
  })
};

globalThis.window = {
  addEventListener: () => {},
  matchMedia: () => ({ matches: false }),
  openMobilePanel: () => {},
  closeMobilePanel: () => {}
};
globalThis.document = {
  getElementById: (id) => mockElem,
  querySelectorAll: () => []
};
globalThis.playSound = () => {};
globalThis.performance = { now: () => Date.now() };

// 2. Require Game Module
const game = require('../js/game.js');
const { state, getTotalRaw, destroyBlock, consumeEnergy, handleInteract, triggerThruster } = game;

describe('Core Digger - Unit Test Suite', () => {

  describe('1. Game Constants & Block Definitions', () => {
    it('defines all subterranean block types with correct HP and attributes', () => {
      assert.strictEqual(c.TILE_SIZE, 32);
      assert.strictEqual(c.GRID_COLS, 16);
      assert.strictEqual(c.SURFACE_ROW, 2);

      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.STEEL_PLATFORM].indestructible, true);
      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.DIRT].hp, 1);
      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.STONE].hp, 3);
      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.HARD_STONE].hp, 4);
      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.DEEPSLATE].hp, 5);

      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.ORE_GOLD].drop, 'gold');
      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.ORE_IRON].drop, 'iron');
      assert.strictEqual(c.BLOCK_DEFS[c.BLOCK_TYPES.ORE_COBALT].drop, 'cobalt');
    });

    it('positions physical surface stations on row 1', () => {
      assert.strictEqual(c.STATIONS.smelter.y, 1);
      assert.strictEqual(c.STATIONS.refuel.y, 1);
      assert.strictEqual(c.STATIONS.merchant.y, 1);
    });
  });

  describe('2. Player State & Spawn Physics', () => {
    it('initializes player on surface platform with full energy', () => {
      assert.strictEqual(state.player.x, 6);
      assert.strictEqual(state.player.y, 1);
      assert.strictEqual(state.energy, 100);
      assert.strictEqual(state.maxEnergy, 100);
      assert.strictEqual(state.maxCargo, 30);
    });

    it('consumes reactor energy properly', () => {
      const initial = state.energy;
      consumeEnergy(15);
      assert.strictEqual(state.energy, initial - 15);
      // Reset
      state.energy = state.maxEnergy;
    });

    it('charges thrusters and consumes fuel on jetpack burst', () => {
      state.energy = 50;
      triggerThruster();
      assert.strictEqual(state.player.isJetpacking, true);
      assert.strictEqual(state.energy, 48); // consumes 2 energy
      // Reset
      state.energy = state.maxEnergy;
      state.player.isJetpacking = false;
    });
  });

  describe('3. Mining & Inventory Cargo Management', () => {
    beforeEach(() => {
      state.rawOres = { dirt: 0, stone: 0, gold: 0, iron: 0, cobalt: 0 };
    });

    it('calculates total raw ore weight correctly', () => {
      state.rawOres.gold = 3;
      state.rawOres.iron = 5;
      state.rawOres.cobalt = 2;
      assert.strictEqual(getTotalRaw(), 10);
    });

    it('cannot destroy indestructible surface steel blocks', () => {
      // (x: 0, y: 2) is steel platform
      state.world.set('0,2', { type: c.BLOCK_TYPES.STEEL_PLATFORM, hp: Infinity, indestructible: true });
      const result = destroyBlock(0, 2);
      assert.strictEqual(result, false);
    });

    it('harvests drops when destructible blocks are mined', () => {
      state.world.set('4,10', { type: c.BLOCK_TYPES.ORE_GOLD, hp: 5, drop: 'gold' });
      const success = destroyBlock(4, 10);
      assert.strictEqual(success, true);
      assert.strictEqual(state.rawOres.gold, 1);
    });
  });

  describe('4. Physical Surface Base & Station Interactions', () => {
    it('fully recharges reactor core when interacting with Refuel Station', () => {
      state.energy = 12;
      state.nearStation = 'refuel';
      handleInteract();
      assert.strictEqual(state.energy, state.maxEnergy);
      state.nearStation = null;
    });

    it('loads raw ores into smelter queue on interact', () => {
      state.rawOres.gold = 4;
      state.rawOres.iron = 2;
      state.nearStation = 'smelter';
      handleInteract();
      assert.strictEqual(state.smelting.active, true);
      assert.strictEqual(state.smelting.queue.length, 6);
      assert.strictEqual(state.rawOres.gold, 0);
      assert.strictEqual(state.rawOres.iron, 0);
      state.nearStation = null;
    });
  });

  describe('5. Tactical Active Abilities', () => {
    it('defines all 3 abilities with costs and cooldowns', () => {
      assert.strictEqual(state.abilities.dynamite.costEnergy, 10);
      assert.strictEqual(state.abilities.dynamite.cooldown, 4.0);

      assert.strictEqual(state.abilities.laser.costEnergy, 25);
      assert.strictEqual(state.abilities.laser.cooldown, 6.0);

      assert.strictEqual(state.abilities.rocket.costEnergy, 40);
      assert.strictEqual(state.abilities.rocket.cooldown, 8.0);
    });
  });

  describe('6. Mobile Touch & Responsive Integrity', () => {
    it('has reusable torches system configured', () => {
      assert.strictEqual(state.torches.max, 5);
      assert.strictEqual(state.torches.inventory, 5);
      assert.ok(Array.isArray(state.torches.deployed));
    });
  });
});
