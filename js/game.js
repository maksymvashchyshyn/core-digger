// --- GAME STATE ---
    const state = {
      player: {
        x: 6, // Spawn on surface deck next to charger and mine shaft
        y: 1,
        renderX: 6 * TILE_SIZE,
        renderY: 1 * TILE_SIZE,
        facing: 1,
        isJetpacking: false,
        isDrilling: false,
        drillAngle: 0,
        fallTimer: 0
      },
      camera: {
        y: 0,
        targetY: 0,
        shake: 0
      },
      // Proximity & Physical Stations
      nearStation: null, // 'smelter' | 'refuel' | 'merchant' | null
      droppedItems: [],  // Array of { type, x, y, vx, vy, groundY, bounceCount }

      // Lighting & Illumination Systems
      flashlight: {
        enabled: true,
        angle: 0.2, // Aim angle in radians
        mouseX: 0,
        mouseY: 0,
        hasMouse: false
      },
      torches: {
        inventory: 5, // Torches currently held in backpack
        max: 5,       // Maximum carry capacity
        deployed: []  // Array of { id, x, y, flickerPhase }
      },

      energy: 100,
      maxEnergy: 100,
      maxCargo: 30,
      drillPower: 1,
      drillTier: 1,
      cargoTier: 0,
      batteryTier: 0,
      torchTier: 0,

      // Inventory
      rawOres: {
        dirt: 0,
        stone: 0,
        gold: 0,
        iron: 0,
        cobalt: 0
      },
      ingots: {
        gold: 0,
        iron: 0,
        cobalt: 0
      },

      // World tiles map: "x,y" => { type, hp, maxHp, indestructible }
      world: new Map(),

      // Smelting
      smelting: {
        active: false,
        timer: 0,
        queue: []
      },

      // Active Tactical Abilities (Dynamite, Core Laser, Rocket Drill)
      abilities: {
        dynamite: {
          unlocked: false,
          costEnergy: 10,
          cooldown: 4.0,
          currentCd: 0,
          costIngots: { iron: 15 }
        },
        laser: {
          unlocked: false,
          costEnergy: 25,
          cooldown: 6.0,
          currentCd: 0,
          costIngots: { gold: 25 }
        },
        rocket: {
          unlocked: false,
          costEnergy: 40,
          cooldown: 8.0,
          currentCd: 0,
          costIngots: { cobalt: 20 }
        }
      },
      lastMoveDir: { x: 1, y: 0 },
      activeEffects: [],

      // Visuals
      particles: [],
      dustMotes: [],
      floatingTexts: []
    };

    // Initialize floating ambient dust motes
    for (let i = 0; i < 35; i++) {
      state.dustMotes.push({
        x: Math.random() * (GRID_COLS * TILE_SIZE),
        y: Math.random() * 800,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.15 + Math.random() * 0.35,
        size: Math.random() * 1.5 + 0.8,
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    // --- PROCEDURAL GENERATION ---
    function pseudoRandom(x, y) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    }

    function generateTile(x, y) {
      if (y < SURFACE_ROW) return { type: BLOCK_TYPES.AIR, hp: 0, maxHp: 0 };

      // Top two rows (Depth 0 and -1: y === SURFACE_ROW and y === SURFACE_ROW + 1) are indestructible Steel Platform
      if (y === SURFACE_ROW || y === SURFACE_ROW + 1) {
        // Mine shaft opening in the center (cols 7 and 8)
        if (x === 7 || x === 8) {
          return { type: BLOCK_TYPES.AIR, hp: 0, maxHp: 0 };
        }
        return { type: BLOCK_TYPES.STEEL_PLATFORM, hp: Infinity, maxHp: Infinity, indestructible: true };
      }

      const depth = y - (SURFACE_ROW + 1);
      const r = pseudoRandom(x, y);
      let type = BLOCK_TYPES.DIRT;

      if (depth >= 1 && depth <= 15) {
        if (r < 0.08) type = BLOCK_TYPES.ORE_GOLD;
        else if (r < 0.42) type = BLOCK_TYPES.STONE;
        else type = BLOCK_TYPES.DIRT;
      } else if (depth >= 16 && depth <= 40) {
        if (r < 0.08) type = BLOCK_TYPES.ORE_IRON;
        else if (r < 0.13) type = BLOCK_TYPES.ORE_GOLD;
        else if (r < 0.70) type = BLOCK_TYPES.HARD_STONE;
        else type = BLOCK_TYPES.STONE;
      } else {
        if (r < 0.07) type = BLOCK_TYPES.ORE_COBALT;
        else if (r < 0.15) type = BLOCK_TYPES.ORE_IRON;
        else if (r < 0.78) type = BLOCK_TYPES.DEEPSLATE;
        else type = BLOCK_TYPES.HARD_STONE;
      }

      const hp = BLOCK_DEFS[type].hp;
      return { type, hp, maxHp: hp };
    }

    function getTile(x, y) {
      if (x < 0 || x >= GRID_COLS || y < 0) return null;
      const key = `${x},${y}`;
      if (!state.world.has(key)) {
        state.world.set(key, generateTile(x, y));
      }
      return state.world.get(key);
    }

    // --- DOM REFERENCES ---
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('excavation-container');

    const hudDepthLabel = document.getElementById('hud-depth-label');
    const hudDrillLabel = document.getElementById('hud-drill-label');
    const hudFlashlightChip = document.getElementById('hud-flashlight-chip');
    const hudFlashlightLabel = document.getElementById('hud-flashlight-label');
    const hudTorchChip = document.getElementById('hud-torch-chip');
    const hudTorchLabel = document.getElementById('hud-torch-label');
    const torchInventoryStatus = document.getElementById('torch-inventory-status');

    const energyNumeric = document.getElementById('energy-numeric');
    const energyFill = document.getElementById('energy-fill');
    const cargoNumeric = document.getElementById('cargo-numeric');
    const capacityFill = document.getElementById('capacity-fill');

    const rawGoldCount = document.getElementById('raw-gold-count');
    const rawIronCount = document.getElementById('raw-iron-count');
    const rawCobaltCount = document.getElementById('raw-cobalt-count');

    const ingotGoldCount = document.getElementById('ingot-gold-count');
    const ingotIronCount = document.getElementById('ingot-iron-count');
    const ingotCobaltCount = document.getElementById('ingot-cobalt-count');

    const btnReturnSurface = document.getElementById('btn-return-surface');
    const btnSmeltAll = document.getElementById('btn-smelt-all');
    const smelterStatusText = document.getElementById('smelter-status-text');
    const smeltProgressFill = document.getElementById('smelt-progress-fill');

    const drillTitle = document.getElementById('drill-title');
    const drillTierLabel = document.getElementById('drill-tier-label');
    const drillDesc = document.getElementById('drill-desc');
    const costDrillGold = document.getElementById('cost-drill-gold');
    const costDrillIron = document.getElementById('cost-drill-iron');
    const costDrillCobalt = document.getElementById('cost-drill-cobalt');
    const btnBuyDrill = document.getElementById('btn-buy-drill');

    const cargoTierLabel = document.getElementById('cargo-tier-label');
    const costCargoGold = document.getElementById('cost-cargo-gold');
    const costCargoIron = document.getElementById('cost-cargo-iron');
    const btnBuyCargo = document.getElementById('btn-buy-cargo');

    const torchTierLabel = document.getElementById('torch-tier-label');
    const costTorchGold = document.getElementById('cost-torch-gold');
    const costTorchIron = document.getElementById('cost-torch-iron');
    const btnBuyTorch = document.getElementById('btn-buy-torch');

    const batteryTierLabel = document.getElementById('battery-tier-label');
    const costBatteryIron = document.getElementById('cost-battery-iron');
    const costBatteryCobalt = document.getElementById('cost-battery-cobalt');
    const btnBuyBattery = document.getElementById('btn-buy-battery');

    const merchantStatusBanner = document.getElementById('merchant-status-banner');
    const merchantStatusIcon = document.getElementById('merchant-status-icon');
    const merchantStatusText = document.getElementById('merchant-status-text');

    // Ability Elements
    const abilityCardDynamite = document.getElementById('ability-card-dynamite');
    const abilityStatusDynamite = document.getElementById('ability-status-dynamite');
    const abilityCdDynamite = document.getElementById('ability-cd-dynamite');
    const tierDynamite = document.getElementById('tier-dynamite');
    const btnBuyDynamite = document.getElementById('btn-buy-dynamite');

    const abilityCardLaser = document.getElementById('ability-card-laser');
    const abilityStatusLaser = document.getElementById('ability-status-laser');
    const abilityCdLaser = document.getElementById('ability-cd-laser');
    const tierLaser = document.getElementById('tier-laser');
    const btnBuyLaser = document.getElementById('btn-buy-laser');

    const abilityCardRocket = document.getElementById('ability-card-rocket');
    const abilityStatusRocket = document.getElementById('ability-status-rocket');
    const abilityCdRocket = document.getElementById('ability-cd-rocket');
    const tierRocket = document.getElementById('tier-rocket');
    const btnBuyRocket = document.getElementById('btn-buy-rocket');



    const gameToast = document.getElementById('game-toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastText = document.getElementById('toast-text');

    // --- TAB SWITCHING ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // --- TOAST NOTIFICATIONS ---
    let toastTimeout = null;
    function showToast(msg, icon = '⚡', isDanger = false) {
      toastIcon.textContent = icon;
      toastText.textContent = msg;
      gameToast.className = isDanger ? 'show danger' : 'show';
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        gameToast.className = '';
      }, 2500);
    }

    function getTotalRaw() {
      return state.rawOres.gold + state.rawOres.iron + state.rawOres.cobalt + (state.rawOres.dirt || 0) + (state.rawOres.stone || 0);
    }

    // --- FLASHLIGHT & TORCH INTERACTION ---
    function toggleFlashlight() {
      state.flashlight.enabled = !state.flashlight.enabled;
      playSound('flashlight_click');
      hudFlashlightLabel.textContent = `LIGHT: ${state.flashlight.enabled ? 'HIGH-BEAM [F]' : 'OFF [F]'}`;
      hudFlashlightChip.style.color = state.flashlight.enabled ? 'var(--hazard-yellow)' : 'var(--text-muted)';
      showToast(`Floodlight ${state.flashlight.enabled ? 'ENGAGED' : 'DISENGAGED'}`, '🔦');
    }
    hudFlashlightChip.addEventListener('click', toggleFlashlight);

    // Track mouse on canvas for flashlight aiming
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      state.flashlight.mouseX = e.clientX - rect.left;
      state.flashlight.mouseY = e.clientY - rect.top;
      state.flashlight.hasMouse = true;
    });

    canvas.addEventListener('mouseleave', () => {
      state.flashlight.hasMouse = false;
    });

    // Deploy or Retrieve Reusable Torch Beacon
    function handleTorchAction() {
      const playerCenterX = state.player.renderX + TILE_SIZE / 2;
      const playerCenterY = state.player.renderY + TILE_SIZE / 2;

      // Check if near any deployed torch (< 38px distance)
      const nearIndex = state.torches.deployed.findIndex(t => {
        const dist = Math.hypot(t.x - playerCenterX, t.y - playerCenterY);
        return dist < 38;
      });

      if (nearIndex !== -1) {
        // Retrieve torch!
        const retrieved = state.torches.deployed.splice(nearIndex, 1)[0];
        state.torches.inventory = Math.min(state.torches.max, state.torches.inventory + 1);
        playSound('torch_pickup');
        showToast(`Torch Beacon Retrieved! (${state.torches.inventory}/${state.torches.max} available)`, '🔥');
        spawnFloatingText(retrieved.x, retrieved.y, "TORCH RETRIEVED", "#fb923c");
      } else {
        // Deploy new torch if available
        if (state.torches.inventory > 0) {
          state.torches.inventory -= 1;
          const newTorch = {
            id: Date.now() + Math.random(),
            x: playerCenterX,
            y: playerCenterY,
            flickerPhase: Math.random() * Math.PI * 2
          };
          state.torches.deployed.push(newTorch);
          playSound('torch_place');
          showToast(`Luminescent Torch Deployed! (${state.torches.inventory} left)`, '🔥');
          spawnFloatingText(playerCenterX, playerCenterY, "TORCH PLACED", "#facc15");

          // Small spark burst
          for (let i = 0; i < 8; i++) {
            state.particles.push({
              x: playerCenterX,
              y: playerCenterY,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              color: '#fb923c',
              life: 1.0,
              decay: 0.05,
              size: 2.5
            });
          }
        } else {
          showToast(`No Torches in Inventory! (${state.torches.deployed.length} active in mine)`, '⚠️', true);
        }
      }
      updateUI();
    }
    hudTorchChip.addEventListener('click', handleTorchAction);

    // --- EMERGENCY RECALL & SAFE DOCKING ---
    function passOut() {
      playSound('alarm');
      const lostGold = Math.floor(state.rawOres.gold * 0.5);
      const lostIron = Math.floor(state.rawOres.iron * 0.5);
      const lostCobalt = Math.floor(state.rawOres.cobalt * 0.5);

      state.rawOres.gold -= lostGold;
      state.rawOres.iron -= lostIron;
      state.rawOres.cobalt -= lostCobalt;

      state.player.x = 6;
      state.player.y = 1;
      state.player.renderX = state.player.x * TILE_SIZE;
      state.player.renderY = state.player.y * TILE_SIZE;
      state.energy = state.maxEnergy;

      showToast(`CRITICAL POWER FAILURE! Rig recovered, lost 50% raw ores.`, '💀', true);
      updateUI();
    }

    function dockAtSurfaceSafe() {
      if (state.energy < 10) return;
      state.energy = Math.max(0, state.energy - 10);
      state.player.x = 6;
      state.player.y = 1;
      state.player.renderX = state.player.x * TILE_SIZE;
      state.player.renderY = state.player.y * TILE_SIZE;
      state.energy = state.maxEnergy; // Refuel upon docking

      playSound('recharge');
      showToast(`Surface Docking Successful. All systems refueled!`, '🚀');
      updateUI();
    }
    btnReturnSurface.addEventListener('click', dockAtSurfaceSafe);



    // --- CONTROLS & PHYSICS ---
    const keys = {};
    window.addEventListener('keydown', (e) => {


      // If developer menu is open, block all game inputs (movement, abilities, digging)
      if (state.devMenuOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          toggleDevMenu(false);
        }
        return;
      }

      keys[e.key] = true;
      if (['ArrowUp', 'KeyW', 'w', 'W'].includes(e.key)) {
        triggerThruster();
      } else if (['ArrowLeft', 'KeyA', 'a', 'A'].includes(e.key)) {
        moveDigger(-1, 0);
      } else if (['ArrowRight', 'KeyD', 'd', 'D'].includes(e.key)) {
        moveDigger(1, 0);
      } else if (['ArrowDown', 'KeyS', 's', 'S'].includes(e.key)) {
        moveDigger(0, 1);
      } else if (['KeyF', 'f', 'F'].includes(e.key)) {
        toggleFlashlight();
      } else if (['KeyT', 't', 'T'].includes(e.key)) {
        handleTorchAction();
      } else if (['KeyE', 'e', 'E'].includes(e.key)) {
        handleInteract();
      } else if (e.key === '1') {
        triggerAbility(1);
      } else if (e.key === '2') {
        triggerAbility(2);
      } else if (e.key === '3') {
        triggerAbility(3);
      }
    });

    // Click handlers for bottom-left HUD ability cards
    if (abilityCardDynamite) abilityCardDynamite.addEventListener('click', () => triggerAbility(1));
    if (abilityCardLaser) abilityCardLaser.addEventListener('click', () => triggerAbility(2));
    if (abilityCardRocket) abilityCardRocket.addEventListener('click', () => triggerAbility(3));

    window.addEventListener('keyup', (e) => {
      keys[e.key] = false;
      if (['ArrowUp', 'KeyW', 'w', 'W'].includes(e.key)) {
        state.player.isJetpacking = false;
      }
    });

    function handleInteract() {
      if (state.nearStation === 'refuel') {
        state.energy = state.maxEnergy;
        playSound('recharge');
        const refuelPx = STATIONS.refuel.x * TILE_SIZE + TILE_SIZE / 2;
        const refuelPy = SURFACE_ROW * TILE_SIZE;
        for (let i = 0; i < 16; i++) {
          state.particles.push({
            x: refuelPx + (Math.random() - 0.5) * 22,
            y: refuelPy - Math.random() * 24,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3.5 - 1.2,
            color: Math.random() > 0.4 ? '#4ade80' : '#22c55e',
            life: 1.0,
            decay: 0.04,
            size: Math.random() * 3 + 2
          });
        }
        spawnFloatingText(refuelPx, refuelPy - 36, '+FULL CHARGE (100%)', '#4ade80');
        showToast('Reactor Refueled to 100%! All power cells fully charged.', '🔋');
        updateUI();
      } else if (state.nearStation === 'smelter') {
        const totalRaw = getTotalRaw();
        if (totalRaw > 0) {
          if (state.smelting.active) {
            for (let i = 0; i < state.rawOres.gold; i++) state.smelting.queue.push('gold');
            for (let i = 0; i < state.rawOres.iron; i++) state.smelting.queue.push('iron');
            for (let i = 0; i < state.rawOres.cobalt; i++) state.smelting.queue.push('cobalt');
          } else {
            const queue = [];
            for (let i = 0; i < state.rawOres.gold; i++) queue.push('gold');
            for (let i = 0; i < state.rawOres.iron; i++) queue.push('iron');
            for (let i = 0; i < state.rawOres.cobalt; i++) queue.push('cobalt');
            state.smelting.active = true;
            state.smelting.queue = queue;
            state.smelting.timer = 0;
          }
          state.rawOres.gold = 0;
          state.rawOres.iron = 0;
          state.rawOres.cobalt = 0;

          playSound('refine');
          const smelterPx = STATIONS.smelter.x * TILE_SIZE + TILE_SIZE / 2;
          const smelterPy = SURFACE_ROW * TILE_SIZE;
          spawnFloatingText(smelterPx, smelterPy - 38, `LOADED ${totalRaw} ORES INTO SMELTER`, '#f97316');
          showToast(`Transferred ${totalRaw} ores into furnace! Bouncing ingots will drop soon.`, '🔥');
          updateUI();
        } else if (state.smelting.active) {
          showToast(`Furnace is smelting... (${state.smelting.queue.length} ores remaining)`, '🔥');
        } else {
          showToast('Backpack has no raw ores to smelt! Mine some ore veins first.', '⚠️', true);
        }
      } else if (state.nearStation === 'merchant') {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const engBtn = document.querySelector('.tab-btn[data-tab="tab-engineering"]');
        if (engBtn) engBtn.classList.add('active');
        const engTab = document.getElementById('tab-engineering');
        if (engTab) engTab.classList.add('active');
        playSound('ore');
        if (window.openMobilePanel) window.openMobilePanel();
        showToast('Merchant Trading Post Open! Ready to upgrade equipment.', '🏪');
        updateUI();
      } else {
        const playerCenterX = state.player.renderX + TILE_SIZE / 2;
        const playerCenterY = state.player.renderY + TILE_SIZE / 2;
        const nearIndex = state.torches.deployed.findIndex(t => Math.hypot(t.x - playerCenterX, t.y - playerCenterY) < 38);
        if (nearIndex !== -1) {
          handleTorchAction();
        } else {
          showToast('No interactive station or beacon in range. Move closer to [E].', 'ℹ️');
        }
      }
    }

    let lastMoveTime = 0;
    const MOVE_COOLDOWN = 140;

    function moveDigger(dx, dy) {
      const now = performance.now();
      if (now - lastMoveTime < MOVE_COOLDOWN) return;
      lastMoveTime = now;

      if (dx !== 0) {
        state.player.facing = dx;
        state.lastMoveDir = { x: dx, y: 0 };
      } else if (dy > 0) {
        state.lastMoveDir = { x: 0, y: 1 };
      }

      const targetX = state.player.x + dx;
      const targetY = state.player.y + dy;

      if (targetX < 0 || targetX >= GRID_COLS || targetY < 0) return;

      const tile = getTile(targetX, targetY);

      // Open cavity
      if (!tile || tile.type === BLOCK_TYPES.AIR) {
        state.player.x = targetX;
        state.player.y = targetY;
        consumeEnergy(0.5);
        return;
      }

      // Solid block: Drill it!
      drillBlock(targetX, targetY, tile);
    }

    function triggerThruster() {
      state.player.isJetpacking = true;
      state.lastMoveDir = { x: state.player.facing, y: -1 };
      const targetY = state.player.y - 1;
      if (targetY < 0) return;

      consumeEnergy(2.0);
      playSound('thruster');
      spawnThrusterParticles();

      const tile = getTile(state.player.x, targetY);
      if (!tile || tile.type === BLOCK_TYPES.AIR) {
        state.player.y = targetY;
      } else {
        drillBlock(state.player.x, targetY, tile);
      }
    }

    // --- CENTRAL BLOCK DESTRUCTION & LOOT LOGIC ---
    function destroyBlock(gridX, gridY) {
      if (gridX < 0 || gridX >= GRID_COLS || gridY < 0) return false;
      const tile = getTile(gridX, gridY);
      if (!tile || tile.type === BLOCK_TYPES.AIR || tile.indestructible) return false;

      const drop = BLOCK_DEFS[tile.type] ? BLOCK_DEFS[tile.type].drop : null;
      const px = gridX * TILE_SIZE + TILE_SIZE / 2;
      const py = gridY * TILE_SIZE + TILE_SIZE / 2;

      if (drop) {
        if (getTotalRaw() < state.maxCargo) {
          playSound('ore');
          state.rawOres[drop] = (state.rawOres[drop] || 0) + 1;
          const dropColor = drop === 'gold' ? '#fbbf24' : (drop === 'iron' ? '#ea580c' : '#38bdf8');
          spawnFloatingText(px, py, `+1 Raw ${drop.toUpperCase()}`, dropColor);
        } else {
          showToast('CARGO FULL! Cannot collect more raw ores.', '⚠️', true);
          spawnFloatingText(px, py, `CARGO FULL!`, '#ef4444');
        }
      }

      tile.type = BLOCK_TYPES.AIR;
      spawnRuptureDebris(px, py);
      state.camera.shake = Math.max(state.camera.shake, 4.0);
      return true;
    }

    // --- ACTIVE ABILITIES TRIGGER LOGIC ---
    function triggerAbility(slot) {
      if (slot === 1) { // Dynamite
        const ab = state.abilities.dynamite;
        if (!ab.unlocked) {
          showToast('Dynamite Module locked! Purchase at Merchant stall.', '🔒', true);
          return;
        }
        if (ab.currentCd > 0) {
          showToast(`Dynamite cooling down! (${ab.currentCd.toFixed(1)}s)`, '⏳', true);
          return;
        }
        if (state.energy < ab.costEnergy) {
          showToast('Insufficient Energy for Dynamite! (Requires 10 Energy)', '⚡', true);
          return;
        }
        consumeEnergy(ab.costEnergy);
        ab.currentCd = ab.cooldown;
        playSound('dynamite_drop');

        const gx = state.player.x;
        const gy = state.player.y;
        state.activeEffects.push({
          type: 'dynamite',
          gridX: gx,
          gridY: gy,
          x: gx * TILE_SIZE + TILE_SIZE / 2,
          y: gy * TILE_SIZE + TILE_SIZE / 2,
          timer: 1.5,
          flashPhase: 0
        });
        showToast('Dynamite Dropped! Detonating 3x3 in 1.5s...', '🧨');
        updateUI();
      } else if (slot === 2) { // Core Laser
        const ab = state.abilities.laser;
        if (!ab.unlocked) {
          showToast('Core Laser locked! Purchase at Merchant stall.', '🔒', true);
          return;
        }
        if (ab.currentCd > 0) {
          showToast(`Core Laser cooling down! (${ab.currentCd.toFixed(1)}s)`, '⏳', true);
          return;
        }
        if (state.energy < ab.costEnergy) {
          showToast('Insufficient Energy for Core Laser! (Requires 25 Energy)', '⚡', true);
          return;
        }
        consumeEnergy(ab.costEnergy);
        ab.currentCd = ab.cooldown;
        playSound('laser');

        const gx = state.player.x;
        const gy = state.player.y;
        const startX = gx * TILE_SIZE + TILE_SIZE / 2;
        const startY = (gy + 1) * TILE_SIZE;
        const endY = (gy + 6) * TILE_SIZE;

        let hitCount = 0;
        for (let i = 1; i <= 5; i++) {
          const destroyed = destroyBlock(gx, gy + i);
          if (destroyed) hitCount++;
        }

        state.camera.shake = 5.5;
        state.activeEffects.push({
          type: 'laser',
          x: startX,
          startY: startY,
          endY: endY,
          life: 0.3,
          maxLife: 0.3
        });
        showToast(`Core Laser Fired! Vaporized ${hitCount} vertical blocks.`, '⚡');
        updateUI();
      } else if (slot === 3) { // Rocket Drill
        const ab = state.abilities.rocket;
        if (!ab.unlocked) {
          showToast('Rocket Drill locked! Purchase at Merchant stall.', '🔒', true);
          return;
        }
        if (ab.currentCd > 0) {
          showToast(`Rocket Drill cooling down! (${ab.currentCd.toFixed(1)}s)`, '⏳', true);
          return;
        }
        if (state.energy < ab.costEnergy) {
          showToast('Insufficient Energy for Rocket Drill! (Requires 40 Energy)', '⚡', true);
          return;
        }
        consumeEnergy(ab.costEnergy);
        ab.currentCd = ab.cooldown;
        playSound('rocket_launch');

        let dirX = state.lastMoveDir ? state.lastMoveDir.x : state.player.facing;
        let dirY = state.lastMoveDir ? state.lastMoveDir.y : 0;
        if (dirX === 0 && dirY === 0) dirX = state.player.facing;

        const angle = Math.atan2(dirY, dirX);
        const speed = 420;

        state.activeEffects.push({
          type: 'rocket',
          x: state.player.renderX + TILE_SIZE / 2 + dirX * 16,
          y: state.player.renderY + TILE_SIZE / 2 + dirY * 16,
          vx: dirX * speed,
          vy: dirY * speed,
          dirX: dirX,
          dirY: dirY,
          angle: angle,
          blocksHit: 0,
          maxBlocks: 4,
          life: 3.5,
          lastTileKey: null
        });
        showToast('Rocket Drill Fired! Piercing forward strata...', '🚀');
        updateUI();
      }
    }

    function detonateRocket(eff, gx, gy) {
      playSound('explosion');
      state.camera.shake = 6.0;
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          destroyBlock(gx + dx, gy + dy);
        }
      }
      state.activeEffects.push({
        type: 'explosion',
        x: eff.x,
        y: eff.y,
        radius: 8,
        maxRadius: 36,
        life: 0.2,
        maxLife: 0.2
      });
      for (let p = 0; p < 14; p++) {
        state.particles.push({
          x: eff.x,
          y: eff.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          color: Math.random() > 0.4 ? '#f97316' : '#cbd5e1',
          life: 0.8,
          decay: 0.06,
          size: Math.random() * 3 + 2
        });
      }
    }

    function drillBlock(tx, ty, tile) {
      if (tile.indestructible) {
        playSound('deflect');
        state.camera.shake = 1.8;
        const px = tx * TILE_SIZE + TILE_SIZE / 2;
        const py = ty * TILE_SIZE + TILE_SIZE / 2;
        spawnRockShards(px, py);
        spawnFloatingText(px, py, 'INDESTRUCTIBLE', '#ef4444');
        showToast('Surface Steel Platform is indestructible!', '🛡️', true);
        return;
      }

      consumeEnergy(1.0);
      playSound('drill');
      state.player.isDrilling = true;

      state.camera.shake = 3.5;

      tile.hp -= state.drillPower;
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;

      spawnRockShards(px, py);

      if (tile.hp <= 0) {
        playSound('break');
        destroyBlock(tx, ty);
      } else {
        spawnFloatingText(px, py, `HP: ${tile.hp}`, '#94a3b8');
      }

      updateUI();
    }

    function consumeEnergy(amount) {
      state.energy = Math.max(0, state.energy - amount);
      if (state.energy <= 0) {
        passOut();
      }
      updateUI();
    }

    // --- PARTICLE DYNAMICS ---
    function spawnRockShards(x, y) {
      for (let i = 0; i < 6; i++) {
        state.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          color: Math.random() > 0.5 ? '#facc15' : '#94a3b8',
          life: 1.0,
          decay: 0.06 + Math.random() * 0.05,
          size: Math.random() * 2.5 + 1.5
        });
      }
    }

    function spawnRuptureDebris(x, y) {
      for (let i = 0; i < 12; i++) {
        state.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 7,
          vy: (Math.random() - 0.8) * 6,
          color: '#475569',
          life: 1.0,
          decay: 0.04 + Math.random() * 0.03,
          size: Math.random() * 3.5 + 2
        });
      }
    }

    function spawnThrusterParticles() {
      const px = state.player.renderX + TILE_SIZE / 2 - (state.player.facing * 8);
      const py = state.player.renderY + TILE_SIZE - 2;
      for (let i = 0; i < 6; i++) {
        state.particles.push({
          x: px + (Math.random() - 0.5) * 8,
          y: py,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 5 + 3,
          color: Math.random() > 0.4 ? '#38bdf8' : '#f97316',
          life: 1.0,
          decay: 0.07,
          size: Math.random() * 3 + 2.5
        });
      }
    }

    function spawnFloatingText(x, y, text, color) {
      state.floatingTexts.push({
        x, y, text, color,
        alpha: 1.0,
        vy: -1.1
      });
    }

    // --- SMELTING FOUNDRY SYSTEM ---
    btnSmeltAll.addEventListener('click', () => {
      handleInteract();
    });

    function updateSmelter(dt) {
      if (!state.smelting.active) return;

      if (state.smelting.queue.length === 0) {
        state.smelting.active = false;
        smelterStatusText.textContent = "🔥 INDUCTION FURNACE IDLE";
        smeltProgressFill.style.width = "0%";
        playSound('ore');
        showToast("Smelting Complete! Walk over dropped ingots to collect.", "✨");
        updateUI();
        return;
      }

      state.smelting.timer += dt;
      const currentOre = state.smelting.queue[0];
      smelterStatusText.textContent = `REFINING RAW ${currentOre.toUpperCase()}... (${state.smelting.queue.length} left)`;

      const progress = Math.min(1.0, state.smelting.timer / 0.5);
      smeltProgressFill.style.width = `${progress * 100}%`;

      if (state.smelting.timer >= 0.5) {
        state.smelting.timer = 0;
        const smelted = state.smelting.queue.shift();
        
        // Spawn bouncing dropped ingot entity on surface near furnace
        const smCenterX = STATIONS.smelter.x * TILE_SIZE + 16;
        const groundY = SURFACE_ROW * TILE_SIZE - 4;
        state.droppedItems.push({
          type: smelted,
          x: smCenterX + (Math.random() - 0.5) * 14,
          y: groundY - 16,
          vx: (Math.random() - 0.5) * 3,
          vy: -2.8 - Math.random() * 1.5,
          groundY: groundY,
          angle: 0,
          rotSpeed: (Math.random() - 0.5) * 6
        });

        playSound('refine');
        updateUI();
      }
    }

    // --- ENGINEERING BAY UPGRADES ---
    const DRILL_TIERS = [
      { name: "Tungsten Auger Drill", power: 2, gold: 10, iron: 0, cobalt: 0 },
      { name: "Diamond-Tip Drill", power: 3, gold: 10, iron: 20, cobalt: 0 },
      { name: "Plasma Sonic Drill", power: 5, gold: 0, iron: 25, cobalt: 15 }
    ];

    btnBuyDrill.addEventListener('click', () => {
      const nextIdx = state.drillTier - 1;
      if (nextIdx >= DRILL_TIERS.length) return;
      const tier = DRILL_TIERS[nextIdx];

      if (state.ingots.gold >= tier.gold && state.ingots.iron >= tier.iron && state.ingots.cobalt >= tier.cobalt) {
        state.ingots.gold -= tier.gold;
        state.ingots.iron -= tier.iron;
        state.ingots.cobalt -= tier.cobalt;

        state.drillTier += 1;
        state.drillPower = tier.power;
        playSound('ore');
        showToast(`Equipped ${tier.name}! Power: ${tier.power}`, '🛠️');
        updateUI();
      }
    });

    btnBuyCargo.addEventListener('click', () => {
      const costG = 5 + state.cargoTier * 5;
      const costI = 10 + state.cargoTier * 10;

      if (state.ingots.gold >= costG && state.ingots.iron >= costI) {
        state.ingots.gold -= costG;
        state.ingots.iron -= costI;
        state.cargoTier += 1;
        state.maxCargo += 15;
        playSound('ore');
        showToast(`Cargo Expanded! Max Capacity: ${state.maxCargo}`, '🎒');
        updateUI();
      }
    });

    btnBuyTorch.addEventListener('click', () => {
      const costG = 8 + state.torchTier * 6;
      const costI = 12 + state.torchTier * 8;

      if (state.ingots.gold >= costG && state.ingots.iron >= costI) {
        state.ingots.gold -= costG;
        state.ingots.iron -= costI;
        state.torchTier += 1;
        state.torches.max += 2;
        state.torches.inventory += 2;
        playSound('torch_place');
        showToast(`Flare Kit Fabricated! Max Torches: ${state.torches.max}`, '🔥');
        updateUI();
      }
    });

    btnBuyBattery.addEventListener('click', () => {
      const costI = 15 + state.batteryTier * 10;
      const costC = 5 + state.batteryTier * 5;

      if (state.ingots.iron >= costI && state.ingots.cobalt >= costC) {
        state.ingots.iron -= costI;
        state.ingots.cobalt -= costC;
        state.batteryTier += 1;
        state.maxEnergy += 30;
        state.energy = state.maxEnergy; // Refuel immediately
        playSound('ore');
        showToast(`Reactor Upgraded! Max Energy: ${state.maxEnergy}`, '🔋');
        updateUI();
      }
    });

    // Tactical Modules Purchasing Listeners
    btnBuyDynamite.addEventListener('click', () => {
      if (!state.abilities.dynamite.unlocked && state.ingots.iron >= 15 && state.nearStation === 'merchant') {
        state.ingots.iron -= 15;
        state.abilities.dynamite.unlocked = true;
        playSound('ore');
        showToast('Dynamite Module Installed! Press [1] to drop explosives.', '🧨');
        updateUI();
      }
    });

    btnBuyLaser.addEventListener('click', () => {
      if (!state.abilities.laser.unlocked && state.ingots.gold >= 25 && state.nearStation === 'merchant') {
        state.ingots.gold -= 25;
        state.abilities.laser.unlocked = true;
        playSound('ore');
        showToast('Core Laser Lance Installed! Press [2] to fire vertical beam.', '⚡');
        updateUI();
      }
    });

    btnBuyRocket.addEventListener('click', () => {
      if (!state.abilities.rocket.unlocked && state.ingots.cobalt >= 20 && state.nearStation === 'merchant') {
        state.ingots.cobalt -= 20;
        state.abilities.rocket.unlocked = true;
        playSound('ore');
        showToast('Rocket Drill Module Installed! Press [3] to launch rockets.', '🚀');
        updateUI();
      }
    });

    // --- UI TELEMETRY UPDATER ---
    function updateUI() {
      const totalRaw = getTotalRaw();
      // Depth
      const currentDepth = Math.max(0, state.player.y - SURFACE_ROW);
      hudDepthLabel.textContent = `DEPTH: ${currentDepth * 2}m`;
      hudDrillLabel.textContent = `AUGER POWER: ${state.drillPower}`;

      // Torch Status
      hudTorchLabel.textContent = `TORCHES: ${state.torches.inventory}/${state.torches.max} [T/E]`;
      torchInventoryStatus.textContent = `${state.torches.inventory} / ${state.torches.max} Stored (${state.torches.deployed.length} Placed)`;

      // Energy Bar
      const energyPct = Math.max(0, Math.min(100, (state.energy / state.maxEnergy) * 100));
      energyFill.style.width = `${energyPct}%`;
      energyNumeric.textContent = `${Math.ceil(state.energy)} / ${state.maxEnergy}`;
      if (energyPct < 25) energyFill.classList.add('danger');
      else energyFill.classList.remove('danger');

      btnReturnSurface.disabled = state.energy < 10 || state.player.y <= SURFACE_ROW;

      // Mobile Top Bar & Dynamic Touch Controls
      const mobileCargoPill = document.getElementById('mobile-cargo-pill');
      const mobilePanelToggleBtn = document.getElementById('btn-toggle-mobile-panel');
      if (mobileCargoPill) {
        mobileCargoPill.textContent = `${totalRaw}/${state.maxCargo} CARGO`;
      }

      const touchInteractBtn = document.getElementById('btn-touch-interact');
      const touchInteractIcon = document.getElementById('touch-interact-icon');
      const touchInteractLabel = document.getElementById('touch-interact-label');
      const touchTorchCount = document.getElementById('touch-torch-count');
      if (touchTorchCount) {
        touchTorchCount.textContent = `${state.torches.inventory}/${state.torches.max}`;
      }

      if (touchInteractBtn && touchInteractIcon && touchInteractLabel) {
        if (state.nearStation === 'refuel') {
          touchInteractBtn.classList.add('highlight-interact');
          touchInteractIcon.textContent = '🔋';
          touchInteractLabel.textContent = 'REFUEL';
          if (mobilePanelToggleBtn) mobilePanelToggleBtn.classList.add('pulse-alert');
        } else if (state.nearStation === 'smelter') {
          touchInteractBtn.classList.add('highlight-interact');
          touchInteractIcon.textContent = '🔥';
          touchInteractLabel.textContent = 'SMELT';
          if (mobilePanelToggleBtn) mobilePanelToggleBtn.classList.add('pulse-alert');
        } else if (state.nearStation === 'merchant') {
          touchInteractBtn.classList.add('highlight-interact');
          touchInteractIcon.textContent = '🏪';
          touchInteractLabel.textContent = 'SHOP';
          if (mobilePanelToggleBtn) mobilePanelToggleBtn.classList.add('pulse-alert');
        } else {
          const playerCenterX = state.player.renderX + TILE_SIZE / 2;
          const playerCenterY = state.player.renderY + TILE_SIZE / 2;
          const nearTorch = state.torches.deployed.some(t => Math.hypot(t.x - playerCenterX, t.y - playerCenterY) < 38);
          if (nearTorch) {
            touchInteractBtn.classList.add('highlight-interact');
            touchInteractIcon.textContent = '🔥';
            touchInteractLabel.textContent = 'PICKUP';
          } else {
            touchInteractBtn.classList.remove('highlight-interact');
            touchInteractIcon.textContent = '⚡';
            touchInteractLabel.textContent = '[E] USE';
            if (mobilePanelToggleBtn) mobilePanelToggleBtn.classList.remove('pulse-alert');
          }
        }
      }

      // Cargo
      cargoNumeric.textContent = `${totalRaw} / ${state.maxCargo}`;
      capacityFill.style.width = `${Math.min(100, (totalRaw / state.maxCargo) * 100)}%`;

      // Raw Ores
      rawGoldCount.textContent = state.rawOres.gold;
      rawIronCount.textContent = state.rawOres.iron;
      rawCobaltCount.textContent = state.rawOres.cobalt;

      // Ingots
      ingotGoldCount.textContent = state.ingots.gold;
      ingotIronCount.textContent = state.ingots.iron;
      ingotCobaltCount.textContent = state.ingots.cobalt;

      // Smelter
      const isAtSmelter = state.nearStation === 'smelter';
      btnSmeltAll.disabled = !isAtSmelter || state.smelting.active || totalRaw <= 0;

      // Merchant Station Proximity Banner & Lock
      const isAtMerchant = state.nearStation === 'merchant';
      if (merchantStatusBanner) {
        if (isAtMerchant) {
          merchantStatusBanner.className = 'merchant-banner-connected';
          merchantStatusIcon.textContent = '🟢';
          merchantStatusText.textContent = 'CONNECTED TO MERCHANT TRADING POST [E]';
        } else {
          merchantStatusBanner.className = 'merchant-banner-locked';
          merchantStatusIcon.textContent = '🔒';
          merchantStatusText.textContent = 'WALK TO SURFACE MERCHANT [E] TO TRADE';
        }
      }

      // Drill Upgrades
      const nextDIdx = state.drillTier - 1;
      if (nextDIdx < DRILL_TIERS.length) {
        const nextD = DRILL_TIERS[nextDIdx];
        drillTitle.textContent = nextD.name;
        drillTierLabel.textContent = `Tier ${state.drillTier + 1}`;
        drillDesc.textContent = `Upgrades drill torque to deliver ${nextD.power} damage per strike.`;
        costDrillGold.textContent = `${nextD.gold} Gold`;
        costDrillIron.textContent = `${nextD.iron} Iron`;
        costDrillCobalt.textContent = `${nextD.cobalt} Cobalt`;
        btnBuyDrill.disabled = !isAtMerchant || state.ingots.gold < nextD.gold || state.ingots.iron < nextD.iron || state.ingots.cobalt < nextD.cobalt;
      } else {
        drillTitle.textContent = "Apex Titanium Auger (MAX)";
        drillTierLabel.textContent = "MAX";
        drillDesc.textContent = "Maximum excavation efficiency achieved!";
        btnBuyDrill.disabled = true;
      }

      // Cargo Upgrades
      const cCostG = 5 + state.cargoTier * 5;
      const cCostI = 10 + state.cargoTier * 10;
      cargoTierLabel.textContent = `Tier ${state.cargoTier}`;
      costCargoGold.textContent = `${cCostG} Gold`;
      costCargoIron.textContent = `${cCostI} Iron`;
      btnBuyCargo.disabled = !isAtMerchant || state.ingots.gold < cCostG || state.ingots.iron < cCostI;

      // Torch Upgrades
      const tCostG = 8 + state.torchTier * 6;
      const tCostI = 12 + state.torchTier * 8;
      torchTierLabel.textContent = `Tier ${state.torchTier}`;
      costTorchGold.textContent = `${tCostG} Gold`;
      costTorchIron.textContent = `${tCostI} Iron`;
      btnBuyTorch.disabled = !isAtMerchant || state.ingots.gold < tCostG || state.ingots.iron < tCostI;

      // Battery Upgrades
      const batCostI = 15 + state.batteryTier * 10;
      const batCostC = 5 + state.batteryTier * 5;
      batteryTierLabel.textContent = `Tier ${state.batteryTier}`;
      costBatteryIron.textContent = `${batCostI} Iron`;
      costBatteryCobalt.textContent = `${batCostC} Cobalt`;
      btnBuyBattery.disabled = !isAtMerchant || state.ingots.iron < batCostI || state.ingots.cobalt < batCostC;

      // Active Abilities: Shop Status & Purchase Buttons
      if (state.abilities.dynamite.unlocked) {
        tierDynamite.textContent = "UNLOCKED";
        btnBuyDynamite.disabled = true;
        btnBuyDynamite.innerHTML = "<span>INSTALLED / READY</span>";
      } else {
        tierDynamite.textContent = "LOCKED";
        btnBuyDynamite.disabled = !isAtMerchant || state.ingots.iron < 15;
        btnBuyDynamite.innerHTML = "<span>Unlock Dynamite (15 Iron)</span>";
      }

      if (state.abilities.laser.unlocked) {
        tierLaser.textContent = "UNLOCKED";
        btnBuyLaser.disabled = true;
        btnBuyLaser.innerHTML = "<span>INSTALLED / READY</span>";
      } else {
        tierLaser.textContent = "LOCKED";
        btnBuyLaser.disabled = !isAtMerchant || state.ingots.gold < 25;
        btnBuyLaser.innerHTML = "<span>Unlock Core Laser (25 Gold)</span>";
      }

      if (state.abilities.rocket.unlocked) {
        tierRocket.textContent = "UNLOCKED";
        btnBuyRocket.disabled = true;
        btnBuyRocket.innerHTML = "<span>INSTALLED / READY</span>";
      } else {
        tierRocket.textContent = "LOCKED";
        btnBuyRocket.disabled = !isAtMerchant || state.ingots.cobalt < 20;
        btnBuyRocket.innerHTML = "<span>Unlock Rocket Drill (20 Cobalt)</span>";
      }

      // Active Abilities: Bottom-Left HUD Cards & Visual Cooldowns
      for (const [key, ab] of Object.entries(state.abilities)) {
        const card = document.getElementById(`ability-card-${key}`);
        const statusEl = document.getElementById(`ability-status-${key}`);
        const cdOverlay = document.getElementById(`ability-cd-${key}`);
        if (!card || !statusEl || !cdOverlay) continue;

        if (!ab.unlocked) {
          card.className = 'ability-card locked';
          statusEl.textContent = 'LOCKED';
          cdOverlay.className = 'ability-cd-overlay';
          cdOverlay.textContent = '';
        } else if (ab.currentCd > 0) {
          card.className = 'ability-card';
          statusEl.textContent = `${ab.currentCd.toFixed(1)}s`;
          cdOverlay.className = 'ability-cd-overlay active';
          cdOverlay.textContent = `${ab.currentCd.toFixed(1)}s`;
        } else {
          card.className = 'ability-card ready';
          statusEl.textContent = 'READY';
          cdOverlay.className = 'ability-cd-overlay';
          cdOverlay.textContent = '';
        }
      }
    }

    // --- MAIN GAME LOOP: UPDATE & DRAW ---
    let lastTime = performance.now();

    function update(dt) {
      // 0. Update Ability Cooldowns
      for (const ab of Object.values(state.abilities)) {
        if (ab.currentCd > 0) {
          ab.currentCd = Math.max(0, ab.currentCd - dt);
        }
      }

      // 0.5 Update Active Effects (Dynamite, Laser, Rocket, Explosion)
      for (let i = state.activeEffects.length - 1; i >= 0; i--) {
        const eff = state.activeEffects[i];

        if (eff.type === 'dynamite') {
          eff.timer -= dt;
          eff.flashPhase += dt * 15;
          if (eff.timer <= 0) {
            playSound('explosion');
            state.camera.shake = 8.0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                destroyBlock(eff.gridX + dx, eff.gridY + dy);
              }
            }
            state.activeEffects.push({
              type: 'explosion',
              x: eff.x,
              y: eff.y,
              radius: 12,
              maxRadius: 52,
              life: 0.2,
              maxLife: 0.2
            });
            for (let p = 0; p < 20; p++) {
              state.particles.push({
                x: eff.x,
                y: eff.y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                color: Math.random() > 0.4 ? '#f97316' : '#facc15',
                life: 1.0,
                decay: 0.05,
                size: Math.random() * 4 + 2
              });
            }
            state.activeEffects.splice(i, 1);
          }
        } else if (eff.type === 'laser') {
          eff.life -= dt;
          if (eff.life <= 0) {
            state.activeEffects.splice(i, 1);
          }
        } else if (eff.type === 'explosion') {
          eff.life -= dt;
          eff.radius += (eff.maxRadius - eff.radius) * (dt * 15);
          if (eff.life <= 0) {
            state.activeEffects.splice(i, 1);
          }
        } else if (eff.type === 'rocket') {
          eff.life -= dt;
          eff.x += eff.vx * dt;
          eff.y += eff.vy * dt;

          if (Math.random() < 0.6) {
            state.particles.push({
              x: eff.x - eff.dirX * 8 + (Math.random() - 0.5) * 4,
              y: eff.y - eff.dirY * 8 + (Math.random() - 0.5) * 4,
              vx: -eff.dirX * 0.5 + (Math.random() - 0.5) * 0.5,
              vy: -eff.dirY * 0.5 + (Math.random() - 0.5) * 0.5,
              color: Math.random() > 0.4 ? '#64748b' : '#f97316',
              life: 0.8,
              decay: 0.05,
              size: Math.random() * 3 + 1.5
            });
          }

          const gx = Math.floor(eff.x / TILE_SIZE);
          const gy = Math.floor(eff.y / TILE_SIZE);
          const tileKey = `${gx},${gy}`;

          if (gx < 0 || gx >= GRID_COLS || gy < 0 || eff.life <= 0) {
            detonateRocket(eff, gx, gy);
            state.activeEffects.splice(i, 1);
            continue;
          }

          const tile = getTile(gx, gy);
          if (tile && tile.type !== BLOCK_TYPES.AIR) {
            if (tile.indestructible) {
              detonateRocket(eff, gx, gy);
              state.activeEffects.splice(i, 1);
              continue;
            }

            if (tileKey !== eff.lastTileKey) {
              eff.lastTileKey = tileKey;
              destroyBlock(gx, gy);
              eff.blocksHit++;
              playSound('drill');

              if (eff.blocksHit >= eff.maxBlocks) {
                detonateRocket(eff, gx, gy);
                state.activeEffects.splice(i, 1);
                continue;
              }
            }
          }
        }
      }

      // 1. Gravity Logic: Fall if space below is air and not jetpacking
      if (!keys['ArrowUp'] && !keys['KeyW'] && !keys['w'] && !keys['W']) {
        state.player.fallTimer += dt;
        if (state.player.fallTimer > 0.12) {
          state.player.fallTimer = 0;
          const tileBelow = getTile(state.player.x, state.player.y + 1);
          if (tileBelow && tileBelow.type === BLOCK_TYPES.AIR) {
            state.player.y += 1;
            updateUI();
          }
        }
      } else {
        state.player.fallTimer = 0;
      }

      // 2. Smooth Rig Positioning Interpolation
      const targetPxX = state.player.x * TILE_SIZE;
      const targetPxY = state.player.y * TILE_SIZE;
      state.player.renderX += (targetPxX - state.player.renderX) * 0.35;
      state.player.renderY += (targetPxY - state.player.renderY) * 0.35;

      // Rotate drill bit continuously when drilling or moving
      if (state.player.isDrilling || keys['ArrowLeft'] || keys['ArrowRight'] || keys['KeyA'] || keys['KeyD']) {
        state.player.drillAngle += dt * 35;
      }

      // 3. Camera Scrolling with player + Camera Shake
      state.camera.targetY = state.player.renderY - canvas.height * 0.45;
      if (state.camera.targetY < 0) state.camera.targetY = 0;
      state.camera.y += (state.camera.targetY - state.camera.y) * 0.15;

      if (state.camera.shake > 0) {
        state.camera.shake = Math.max(0, state.camera.shake - dt * 15);
      }

      // 4. Update Flashlight Target Angle (smooth follow mouse or direction)
      const worldOffsetX = Math.floor((canvas.width - GRID_COLS * TILE_SIZE) / 2);
      const rigScreenX = worldOffsetX + state.player.renderX + TILE_SIZE / 2;
      const rigScreenY = state.player.renderY + TILE_SIZE / 2 - state.camera.y;

      if (state.flashlight.hasMouse) {
        const dx = state.flashlight.mouseX - rigScreenX;
        const dy = state.flashlight.mouseY - rigScreenY;
        const targetAngle = Math.atan2(dy, dx);
        // Smooth angle interpolation
        let angleDiff = targetAngle - state.flashlight.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        state.flashlight.angle += angleDiff * 0.2;
      } else {
        const defaultAngle = state.player.facing === 1 ? 0.2 : Math.PI - 0.2;
        let angleDiff = defaultAngle - state.flashlight.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        state.flashlight.angle += angleDiff * 0.15;
      }

      // 5. Update Deployed Torches Flicker
      for (const torch of state.torches.deployed) {
        torch.flickerPhase += dt * 8;
        // Occasionally spawn tiny smoke/spark particle from torch
        if (Math.random() < 0.25) {
          state.particles.push({
            x: torch.x + (Math.random() - 0.5) * 4,
            y: torch.y - 8,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -Math.random() * 1.5 - 0.5,
            color: Math.random() > 0.4 ? '#fb923c' : '#facc15',
            life: 0.8,
            decay: 0.04,
            size: 1.5
          });
        }
      }

      // 6. Update Smelter
      updateSmelter(dt);

      // 6.5 Physical Station Proximity Detection (Within 1.5 blocks on surface)
      let activeNear = null;
      if (state.player.y <= SURFACE_ROW + 1) {
        for (const [stKey, stObj] of Object.entries(STATIONS)) {
          const dist = Math.hypot(state.player.x - stObj.x, state.player.y - stObj.y);
          if (dist <= 1.5) {
            activeNear = stKey;
            break;
          }
        }
      }
      if (state.nearStation !== activeNear) {
        state.nearStation = activeNear;
        updateUI();
      }

      // 6.6 Dropped Ingots Physics & Player Collection
      for (let i = state.droppedItems.length - 1; i >= 0; i--) {
        const item = state.droppedItems[i];
        item.x += item.vx;
        item.y += item.vy;
        item.vy += dt * 12; // gravity
        item.angle += item.rotSpeed * dt;

        // Ground bounce on surface deck
        if (item.y >= item.groundY) {
          item.y = item.groundY;
          item.vy = -item.vy * 0.35;
          item.vx *= 0.6;
          item.rotSpeed *= 0.5;
          if (Math.abs(item.vy) < 0.25) item.vy = 0;
        }

        const dx = rigScreenX - (worldOffsetX + item.x);
        const dy = rigScreenY - (item.y - state.camera.y);
        const dist = Math.hypot(dx, dy);

        // Magnetic attraction if within 45px
        if (dist < 45 && dist > 0.001) {
          item.vx += (dx / dist) * 1.5;
          item.vy += (dy / dist) * 1.5;
        }

        // Collect if within 24px
        if (dist < 24) {
          state.ingots[item.type] = (state.ingots[item.type] || 0) + 1;
          state.droppedItems.splice(i, 1);
          playSound('ore');
          const color = item.type === 'gold' ? '#fbbf24' : (item.type === 'iron' ? '#ea580c' : '#38bdf8');
          spawnFloatingText(item.x, item.y - 10, `+1 ${item.type.toUpperCase()} INGOT`, color);
          updateUI();
        }
      }

      // 7. Update Dust Motes in Cavern
      for (const mote of state.dustMotes) {
        mote.y += mote.vy;
        mote.x += mote.vx;
        if (mote.y > state.camera.y + canvas.height + 50) {
          mote.y = state.camera.y - 50;
          mote.x = Math.random() * (GRID_COLS * TILE_SIZE);
        }
      }

      // 8. Update Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // 9. Update Floating Texts
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= dt * 1.5;
        if (ft.alpha <= 0) state.floatingTexts.splice(i, 1);
      }
    }

    function draw() {
      // 1. Reset composite mode to standard source-over at start of loop
      ctx.globalCompositeOperation = 'source-over';

      // 2. Clear canvas backdrop
      ctx.fillStyle = '#020306';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Safe, validated player and camera positions
      const playerX = (state.player && Number.isFinite(state.player.renderX)) ? state.player.renderX : 0;
      const playerY = (state.player && Number.isFinite(state.player.renderY)) ? state.player.renderY : 0;
      const cameraY = (state.camera && Number.isFinite(state.camera.y)) ? state.camera.y : 0;

      const worldOffsetX = Math.floor((canvas.width - GRID_COLS * TILE_SIZE) / 2);

      // Camera Shake offset
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (state.camera && state.camera.shake > 0) {
        shakeOffsetX = (Math.random() - 0.5) * state.camera.shake;
        shakeOffsetY = (Math.random() - 0.5) * state.camera.shake;
      }

      ctx.save();
      ctx.translate(worldOffsetX + shakeOffsetX, -Math.floor(cameraY) + shakeOffsetY);

      const startY = Math.max(0, Math.floor(cameraY / TILE_SIZE) - 1);
      const endY = startY + Math.ceil(canvas.height / TILE_SIZE) + 3;

      // 1. Draw Surface Sky & Industrial Staging Pad
      if (startY <= SURFACE_ROW) {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, SURFACE_ROW * TILE_SIZE);
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, GRID_COLS * TILE_SIZE, SURFACE_ROW * TILE_SIZE);

        ctx.fillStyle = '#334155';
        ctx.fillRect(0, SURFACE_ROW * TILE_SIZE - 6, GRID_COLS * TILE_SIZE, 6);
        ctx.fillStyle = '#facc15';
        for (let x = 0; x < GRID_COLS * TILE_SIZE; x += 32) {
          ctx.fillRect(x, SURFACE_ROW * TILE_SIZE - 6, 12, 6);
        }
      }

      // 2. Draw Realistic Blocks
      for (let y = startY; y <= endY; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          const tile = getTile(x, y);

          if (!tile || tile.type === BLOCK_TYPES.AIR) {
            ctx.fillStyle = '#04060b';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            continue;
          }

          drawRealisticBlock(ctx, px, py, tile);
        }
      }

      // 2.5 Draw Physical Stations on Surface Base
      drawPhysicalStations(ctx);

      // 2.6 Draw Dropped Bouncing Ingots
      drawDroppedItems(ctx);

      // 2.7 Draw Active Effects (Dynamite, Laser, Rocket, Explosion)
      drawActiveEffects(ctx);

      // 3. Draw Deployed Reusable Torches
      if (state.torches && state.torches.deployed) {
        for (const torch of state.torches.deployed) {
          drawTorchBeacon(ctx, torch.x, torch.y, torch.flickerPhase);
        }
      }

      // 4. Draw Core Digger Mech (Player Character)
      drawCoreDiggerMech(ctx, playerX, playerY, state.player.facing);

      // 5. Draw Particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1.0;

      // 6. Draw Floating Texts
      for (const ft of state.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();

      // 7. Draw Illumination & Light Radius (Vignette) applied last
      drawLightAndVignette(ctx, worldOffsetX, playerX, playerY, cameraY);
    }

    // Realistic procedural block rendering
    function drawRealisticBlock(ctx, x, y, tile) {
      const type = tile.type;

      if (type === BLOCK_TYPES.STEEL_PLATFORM) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x, y, TILE_SIZE, 2);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 2, y + 4, TILE_SIZE - 4, TILE_SIZE - 6);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 3, y + 5, 2, 2);
        ctx.fillRect(x + TILE_SIZE - 5, y + 5, 2, 2);
        ctx.fillRect(x + 3, y + TILE_SIZE - 4, 2, 2);
        ctx.fillRect(x + TILE_SIZE - 5, y + TILE_SIZE - 4, 2, 2);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 8);
        ctx.lineTo(x + TILE_SIZE - 5, y + TILE_SIZE - 5);
        ctx.moveTo(x + TILE_SIZE - 5, y + 8);
        ctx.lineTo(x + 5, y + TILE_SIZE - 5);
        ctx.stroke();
      } else if (type === BLOCK_TYPES.SURFACE_TOPSOIL) {
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(x, y, TILE_SIZE, 5);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(x, y + 5, TILE_SIZE, TILE_SIZE - 5);
        ctx.fillStyle = '#290f03';
        ctx.fillRect(x + 4, y + 10, 4, 3);
        ctx.fillRect(x + 18, y + 18, 5, 4);
      } else if (type === BLOCK_TYPES.DIRT) {
        ctx.fillStyle = '#713f12';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(x, y, TILE_SIZE, 2);
        ctx.fillRect(x, y, 2, TILE_SIZE);
        ctx.fillStyle = '#3e2107';
        ctx.fillRect(x + 3, y + 6, 6, 3);
        ctx.fillRect(x + 14, y + 15, 8, 4);
        ctx.fillRect(x + 6, y + 23, 7, 3);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x + 22, y + 9, 3, 3);
      } else if (type === BLOCK_TYPES.STONE) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x, y, TILE_SIZE, 2);
        ctx.fillRect(x, y, 2, TILE_SIZE);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
        ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 7);
        ctx.lineTo(x + 15, y + 16);
        ctx.lineTo(x + 26, y + 12);
        ctx.stroke();
      } else if (type === BLOCK_TYPES.HARD_STONE) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      } else if (type === BLOCK_TYPES.DEEPSLATE) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#172033';
        ctx.fillRect(x + 2, y + 4, TILE_SIZE - 4, 3);
        ctx.fillRect(x + 2, y + 13, TILE_SIZE - 4, 3);
        ctx.fillRect(x + 2, y + 22, TILE_SIZE - 4, 3);
      } else if (type === BLOCK_TYPES.ORE_GOLD) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        drawRealisticMineralVeins(ctx, x, y, '#fbbf24', '#fef08a', '#d97706');
      } else if (type === BLOCK_TYPES.ORE_IRON) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        drawRealisticMineralVeins(ctx, x, y, '#ea580c', '#fdba74', '#9a3412');
      } else if (type === BLOCK_TYPES.ORE_COBALT) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        drawRealisticMineralVeins(ctx, x, y, '#38bdf8', '#e0f2fe', '#0284c7');
      }

      if (tile.hp < tile.maxHp) {
        const dmg = 1 - (tile.hp / tile.maxHp);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 6);
        ctx.lineTo(x + 14, y + 16);
        ctx.lineTo(x + 26, y + 10);
        if (dmg > 0.45) {
          ctx.lineTo(x + 22, y + 26);
          ctx.lineTo(x + 8, y + 24);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawRealisticMineralVeins(ctx, x, y, mainCol, highlightCol, darkCol) {
      ctx.fillStyle = darkCol;
      ctx.fillRect(x + 6, y + 8, 8, 8);
      ctx.fillStyle = mainCol;
      ctx.fillRect(x + 7, y + 9, 6, 6);
      ctx.fillStyle = highlightCol;
      ctx.fillRect(x + 8, y + 10, 2, 2);

      ctx.fillStyle = darkCol;
      ctx.fillRect(x + 18, y + 16, 9, 8);
      ctx.fillStyle = mainCol;
      ctx.fillRect(x + 19, y + 17, 7, 6);
      ctx.fillStyle = highlightCol;
      ctx.fillRect(x + 20, y + 18, 2, 2);

      ctx.fillStyle = highlightCol;
      ctx.fillRect(x + 12, y + 22, 2, 2);
    }

    // --- PHYSICAL SURFACE STATIONS (Smelter, Refuel, Merchant, Mine Shaft) ---
    function drawPhysicalStations(ctx) {
      const time = performance.now() * 0.001;
      const platformTopY = SURFACE_ROW * TILE_SIZE;

      // 1. Mine Shaft Hazard Warning & Pit Framework (Cols 7 & 8)
      const shaftLeft = 7 * TILE_SIZE;
      const shaftRight = 9 * TILE_SIZE;

      ctx.save();
      // Left and right hazard striped curb markings
      ctx.fillStyle = '#facc15';
      ctx.fillRect(shaftLeft - 14, platformTopY - 6, 14, 6);
      ctx.fillRect(shaftRight, platformTopY - 6, 14, 6);
      ctx.fillStyle = '#0f172a';
      for (let x = shaftLeft - 14; x < shaftLeft; x += 4) ctx.fillRect(x, platformTopY - 6, 2, 6);
      for (let x = shaftRight; x < shaftRight + 14; x += 4) ctx.fillRect(x, platformTopY - 6, 2, 6);

      // Steel Pit Headframe Scaffold above shaft opening
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shaftLeft - 6, platformTopY - 6);
      ctx.lineTo(shaftLeft - 6, platformTopY - 34);
      ctx.lineTo(shaftRight + 6, platformTopY - 34);
      ctx.lineTo(shaftRight + 6, platformTopY - 6);
      ctx.moveTo(shaftLeft - 6, platformTopY - 34);
      ctx.lineTo(shaftRight + 6, platformTopY - 18);
      ctx.moveTo(shaftRight + 6, platformTopY - 34);
      ctx.lineTo(shaftLeft - 6, platformTopY - 18);
      ctx.stroke();

      // Shaft hoist pulley wheel & suspension cable
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(shaftLeft + TILE_SIZE, platformTopY - 34, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(shaftLeft + TILE_SIZE, platformTopY - 29);
      ctx.lineTo(shaftLeft + TILE_SIZE, platformTopY + 24);
      ctx.stroke();
      ctx.restore();

      // 2. The Smelter (Brick Furnace with glowing fire)
      const smX = STATIONS.smelter.x * TILE_SIZE;
      const smY = platformTopY;

      ctx.save();
      // Terracotta brick masonry body
      ctx.fillStyle = '#78350f';
      ctx.fillRect(smX - 4, smY - 38, 40, 38);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(smX - 4, smY - 38, 40, 38);

      // Brick mortar seams
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1;
      for (let by = smY - 32; by < smY; by += 7) {
        ctx.beginPath();
        ctx.moveTo(smX - 4, by);
        ctx.lineTo(smX + 36, by);
        ctx.stroke();
      }
      for (let bx = smX; bx < smX + 36; bx += 10) {
        ctx.beginPath();
        ctx.moveTo(bx, smY - 38);
        ctx.lineTo(bx, smY);
        ctx.stroke();
      }

      // Smelter Chimney Stack
      ctx.fillStyle = '#451a03';
      ctx.fillRect(smX + 9, smY - 50, 14, 12);
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(smX + 7, smY - 52, 18, 4);

      // Animated Chimney Smoke Puff
      const smokeOffset = (time * 16) % 24;
      const smokeAlpha = Math.max(0, 0.5 - (smokeOffset / 32));
      ctx.fillStyle = `rgba(148, 163, 184, ${smokeAlpha})`;
      ctx.beginPath();
      ctx.arc(smX + 16 + Math.sin(time * 3) * 3, smY - 54 - smokeOffset, 4 + smokeOffset * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Arched Firebox door
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(smX + 16, smY - 14, 11, Math.PI, 0, false);
      ctx.rect(smX + 5, smY - 14, 22, 14);
      ctx.fill();

      // Glowing pulsating fire inside firebox
      const fireFlicker = 0.8 + Math.sin(time * 10) * 0.2;
      const fireGrad = ctx.createRadialGradient(smX + 16, smY - 8, 2, smX + 16, smY - 8, 14 * fireFlicker);
      fireGrad.addColorStop(0, '#fef08a');
      fireGrad.addColorStop(0.35, '#f97316');
      fireGrad.addColorStop(0.75, '#ea580c');
      fireGrad.addColorStop(1, 'rgba(124, 45, 18, 0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(smX + 16, smY - 8, 14 * fireFlicker, Math.PI, 0, false);
      ctx.rect(smX + 6, smY - 8, 20, 8);
      ctx.fill();

      // Smelter Signboard
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("SMELTER", smX + 16, smY - 41);

      // Floating Progress Bar directly above physical furnace
      if (state.smelting.active) {
        const barW = 54;
        const barH = 7;
        const barX = smX + 16 - barW / 2;
        const barY = smY - 66;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(barX, barY, barW, barH, 3) : ctx.rect(barX, barY, barW, barH);
        ctx.fill();
        ctx.stroke();

        const progress = Math.min(1.0, state.smelting.timer / 0.5);
        const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        fillGrad.addColorStop(0, '#ea580c');
        fillGrad.addColorStop(1, '#facc15');
        ctx.fillStyle = fillGrad;
        ctx.fillRect(barX + 1, barY + 1, (barW - 2) * progress, barH - 2);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px system-ui, sans-serif';
        ctx.fillText(`SMELTING (${state.smelting.queue.length})`, smX + 16, barY - 3);
      }
      ctx.restore();

      // 3. Refuel Station (High-tech glowing green battery/charging pad)
      const rfX = STATIONS.refuel.x * TILE_SIZE;
      const rfY = platformTopY;

      ctx.save();
      // Floor Charging Pad
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rfX - 4, rfY - 5, 40, 5);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rfX - 4, rfY - 5, 40, 5);

      // Glowing emerald contact inductors
      ctx.fillStyle = '#4ade80';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.fillRect(rfX + 2, rfY - 4, 8, 3);
      ctx.fillRect(rfX + 22, rfY - 4, 8, 3);
      ctx.shadowBlur = 0;

      // Vertical Charging Pylon Tower
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rfX + 10, rfY - 42, 12, 38);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(rfX + 10, rfY - 42, 12, 38);

      // Terminal screen
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(rfX + 11, rfY - 38, 10, 20);

      // Glowing battery icon casing
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1;
      ctx.strokeRect(rfX + 12, rfY - 35, 8, 14);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(rfX + 14, rfY - 37, 4, 2);

      // Pulsing green charging energy cells
      const chargePulse = (time * 4) % 3;
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 6;
      if (chargePulse >= 0) ctx.fillRect(rfX + 13, rfY - 25, 6, 3);
      if (chargePulse >= 1) ctx.fillRect(rfX + 13, rfY - 29, 6, 3);
      if (chargePulse >= 2) ctx.fillRect(rfX + 13, rfY - 33, 6, 3);
      ctx.shadowBlur = 0;

      // Refuel Station Sign
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("REFUEL", rfX + 16, rfY - 45);
      ctx.restore();

      // 4. The Merchant (Wooden stall with small NPC)
      const mcX = STATIONS.merchant.x * TILE_SIZE;
      const mcY = platformTopY;

      ctx.save();
      // Wooden counter table
      ctx.fillStyle = '#78350f';
      ctx.fillRect(mcX - 6, mcY - 18, 44, 18);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(mcX - 8, mcY - 21, 48, 4);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      ctx.strokeRect(mcX - 6, mcY - 18, 44, 18);

      // Counter goods: ore samples in display boxes
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(mcX - 2, mcY - 25, 5, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(mcX + 6, mcY - 26, 4, 5);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(mcX + 24, mcY - 25, 6, 4);

      // Wooden support poles for striped canopy
      ctx.fillStyle = '#451a03';
      ctx.fillRect(mcX - 6, mcY - 48, 3, 28);
      ctx.fillRect(mcX + 35, mcY - 48, 3, 28);

      // Striped Market Awning Canopy
      const awningW = 48;
      const awningH = 12;
      const awningX = mcX - 8;
      const awningY = mcY - 50;

      ctx.beginPath();
      ctx.moveTo(awningX, awningY + awningH);
      ctx.lineTo(awningX + awningW, awningY + awningH);
      ctx.lineTo(awningX + awningW - 4, awningY);
      ctx.lineTo(awningX + 4, awningY);
      ctx.closePath();
      ctx.fillStyle = '#0284c7';
      ctx.fill();

      // White canopy stripes
      ctx.fillStyle = '#f8fafc';
      for (let s = awningX + 6; s < awningX + awningW - 6; s += 10) {
        ctx.fillRect(s, awningY, 5, awningH);
      }

      // Small NPC Trader (distinct purple tunic & goggles)
      const npcX = mcX + 16;
      const npcY = mcY - 21;

      // NPC Body / Robe
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(npcX - 6, npcY - 12, 12, 12);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(npcX - 4, npcY - 10, 8, 8);

      // NPC Head with gentle bobbing
      const bob = Math.sin(time * 3) * 1.5;
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(npcX, npcY - 16 + bob, 5, 0, Math.PI * 2);
      ctx.fill();

      // Trader Cap & Cyan Goggles
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(npcX - 6, npcY - 21 + bob, 12, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(npcX - 4, npcY - 18 + bob, 3, 2);
      ctx.fillRect(npcX + 1, npcY - 18 + bob, 3, 2);

      // Tiny friendly waving hand
      const wave = Math.sin(time * 6) * 3;
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(npcX + 8, npcY - 10 + wave, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Merchant Sign
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("MERCHANT", mcX + 16, awningY - 4);
      ctx.restore();

      // 5. Floating [E] Interaction Prompts when player is within proximity
      if (state.nearStation) {
        const stKey = state.nearStation;
        const stObj = STATIONS[stKey];
        if (stObj) {
          const promptX = stObj.x * TILE_SIZE + 16;
          const promptY = platformTopY - 60 + Math.sin(time * 5) * 3;

          let promptText = "[E] INTERACT";
          let promptColor = "#facc15";
          let promptBorder = "rgba(250, 204, 21, 0.7)";

          if (stKey === 'refuel') {
            promptText = "[E] REFUEL REACTOR";
            promptColor = "#4ade80";
            promptBorder = "rgba(74, 222, 128, 0.8)";
          } else if (stKey === 'smelter') {
            promptText = state.smelting.active ? "[E] SMELTING ACTIVE" : "[E] SMELT ORES";
            promptColor = "#fb923c";
            promptBorder = "rgba(251, 146, 60, 0.8)";
          } else if (stKey === 'merchant') {
            promptText = "[E] TRADE UPGRADES";
            promptColor = "#38bdf8";
            promptBorder = "rgba(56, 189, 248, 0.8)";
          }

          ctx.save();
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          const textMetrics = ctx.measureText(promptText);
          const pillW = textMetrics.width + 16;
          const pillH = 18;

          ctx.fillStyle = 'rgba(11, 15, 23, 0.95)';
          ctx.strokeStyle = promptBorder;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = promptBorder;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(promptX - pillW / 2, promptY - pillH / 2, pillW, pillH, 9) : ctx.rect(promptX - pillW / 2, promptY - pillH / 2, pillW, pillH);
          ctx.fill();
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.fillStyle = promptColor;
          ctx.fillText(promptText, promptX, promptY + 3.5);
          ctx.restore();
        }
      }
    }

    // --- DRAW DROPPED INGOTS BOUNCING ON THE GROUND ---
    function drawDroppedItems(ctx) {
      for (const item of state.droppedItems) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);

        if (item.type === 'gold') {
          // Shiny Gold Bullion Bar
          ctx.fillStyle = '#d97706';
          ctx.fillRect(-7, -4, 14, 8);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(-5, -2, 10, 2);
        } else if (item.type === 'iron') {
          // Rust-Sheen Heavy Iron Ingot
          ctx.fillStyle = '#9a3412';
          ctx.fillRect(-7, -4, 14, 8);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = '#fdba74';
          ctx.fillRect(-5, -2, 10, 2);
        } else if (item.type === 'cobalt') {
          // Luminescent Cobalt Crystal Ingot
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(-7, -4, 14, 8);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(-5, -2, 10, 2);
        }
        ctx.restore();
      }
    }

    // --- DRAW ACTIVE ABILITY EFFECTS (Dynamite, Laser, Rocket, Explosion) ---
    function drawActiveEffects(ctx) {
      for (const eff of state.activeEffects) {
        if (eff.type === 'dynamite') {
          ctx.save();
          ctx.translate(eff.x, eff.y);

          // Small red square that flashes white
          const isWhite = Math.sin(eff.flashPhase) > 0.1;
          ctx.fillStyle = isWhite ? '#ffffff' : '#ef4444';
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-7, -7, 14, 14);
          ctx.strokeRect(-7, -7, 14, 14);

          // Fuse stem & spark
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(2, -11);
          ctx.stroke();

          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(2, -11, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Countdown timer label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(`${Math.max(0, eff.timer).toFixed(1)}s`, 0, -14);
          ctx.restore();
        } else if (eff.type === 'laser') {
          ctx.save();
          const alpha = Math.max(0, eff.life / eff.maxLife);
          const width = 16;
          const height = eff.endY - eff.startY;

          // Glowing aura
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.4})`;
          ctx.fillRect(eff.x - 14, eff.startY, 28, height);

          // Bright neon-blue core rectangle stretching from player down to 5th block
          ctx.fillStyle = `rgba(14, 165, 233, ${alpha * 0.85})`;
          ctx.fillRect(eff.x - width / 2, eff.startY, width, height);

          // Intense white core
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.fillRect(eff.x - 3, eff.startY, 6, height);
          ctx.restore();
        } else if (eff.type === 'explosion') {
          ctx.save();
          const alpha = Math.max(0, eff.life / eff.maxLife);
          const grad = ctx.createRadialGradient(eff.x, eff.y, 2, eff.x, eff.y, eff.radius);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(0.3, `rgba(250, 204, 21, ${alpha * 0.85})`);
          grad.addColorStop(0.7, `rgba(234, 88, 12, ${alpha * 0.6})`);
          grad.addColorStop(1, `rgba(220, 38, 38, 0)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (eff.type === 'rocket') {
          ctx.save();
          ctx.translate(eff.x, eff.y);
          ctx.rotate(eff.angle);

          // Small grey/orange projectile
          // Fins
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-6, -6);
          ctx.lineTo(0, 0);
          ctx.lineTo(-6, 6);
          ctx.fill();

          // Main grey fuselage
          ctx.fillStyle = '#64748b';
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-6, -2, 12, 2);

          // Orange drill tip
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(6, -3);
          ctx.lineTo(12, 0);
          ctx.lineTo(6, 3);
          ctx.closePath();
          ctx.fill();

          // Thruster flame
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(-6, -2);
          ctx.lineTo(-11 - Math.random() * 4, 0);
          ctx.lineTo(-6, 2);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }
    }

    // Draw Reusable Torch Beacon in the world
    function drawTorchBeacon(ctx, x, y, flickerPhase) {
      ctx.save();
      ctx.translate(x, y);

      // Steel tripod base
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-6, 12); ctx.lineTo(0, 0); ctx.lineTo(6, 12);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      // Beacon Stem
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-2, -6, 4, 12);

      // Glowing Flare Crystal Head (Pulsing warm orange)
      const glowScale = 1.0 + Math.sin(flickerPhase) * 0.2;
      ctx.fillStyle = '#ea580c';
      ctx.shadowColor = '#fb923c';
      ctx.shadowBlur = 12 * glowScale;
      ctx.beginPath();
      ctx.arc(0, -7, 4 * glowScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -7, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // Realistic Industrial Core Digger Excavator Mech
    function drawCoreDiggerMech(ctx, x, y, facing) {
      ctx.save();
      ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      ctx.scale(facing, 1);

      // 1. Heavy Caterpillar Tracks (Bottom)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-14, 8, 28, 7);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-12, 10, 4, 3);
      ctx.fillRect(-4, 10, 4, 3);
      ctx.fillRect(4, 10, 4, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-15, 6, 30, 2);

      // 2. Heavy Armored Chassis (Hazard Yellow & Titanium)
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-12, -7, 22, 14);

      // Hazard Black Striping
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(-10, -7); ctx.lineTo(-7, 7); ctx.lineTo(-4, 7); ctx.lineTo(-7, -7); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3, -7); ctx.lineTo(0, 7); ctx.lineTo(3, 7); ctx.lineTo(0, -7); ctx.closePath(); ctx.fill();

      // 3. Cockpit Canopy with cyan HUD reflections
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, -6, 9, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(2, -5, 6, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, -5, 2, 1);

      // 4. Rear Exhaust & Thruster Nozzle
      ctx.fillStyle = '#334155';
      ctx.fillRect(-16, -2, 4, 6);

      // 5. Dual Forward Halogen Headlight Pod
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(9, 0, 3, 5);
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.fillRect(11, 1, 2, 3);
      ctx.shadowBlur = 0;

      // 6. Roof Swivel Spotlight Turret (Indicates flashlight aiming direction)
      ctx.save();
      ctx.translate(3, -9);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Lens
      ctx.fillStyle = state.flashlight.enabled ? '#fef08a' : '#64748b';
      ctx.shadowColor = state.flashlight.enabled ? '#facc15' : 'transparent';
      ctx.shadowBlur = state.flashlight.enabled ? 8 : 0;
      ctx.fillRect(1, -2, 3, 4);
      ctx.shadowBlur = 0;
      ctx.restore();

      // 7. Heavy Rotary Auger Drill Head (Spins during drilling)
      ctx.save();
      ctx.translate(13, 3);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillStyle = '#94a3b8';
      const offset = Math.sin(state.player.drillAngle) * 3;
      ctx.beginPath();
      ctx.moveTo(2, -7 + offset);
      ctx.lineTo(13, 0);
      ctx.lineTo(2, 7 + offset);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(8, -2);
      ctx.lineTo(15, 0);
      ctx.lineTo(8, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }

    // Draw Illumination and Vignette overlay using standard safe Canvas API
    function drawLightAndVignette(ctx, worldOffsetX, playerX, playerY, cameraY) {
      // Prompt requirement: "The lighting gradient should NOT apply on the surface. If player.y is at or above the surface, draw the screen fully lit (no dark overlay)."
      if (state.player && state.player.y <= SURFACE_ROW + 1) {
        return;
      }

      const screenX = worldOffsetX + playerX + TILE_SIZE / 2;
      const screenY = playerY + TILE_SIZE / 2 - cameraY;

      // 1. Draw Bright Yellow Flashlight High-Beam (Normal blending, fully visible!)
      if (state.flashlight && state.flashlight.enabled) {
        const beamReach = 280;
        const coneSpread = Math.PI / 4.2;
        const aimAngle = state.flashlight.angle || 0;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - 5);
        ctx.arc(screenX, screenY - 5, beamReach, aimAngle - coneSpread, aimAngle + coneSpread);
        ctx.closePath();

        const beamGrad = ctx.createRadialGradient(screenX, screenY - 5, 8, screenX, screenY - 5, beamReach);
        beamGrad.addColorStop(0, 'rgba(255, 240, 138, 0.45)'); // Bright glowing yellow
        beamGrad.addColorStop(0.35, 'rgba(250, 204, 21, 0.28)');
        beamGrad.addColorStop(0.7, 'rgba(234, 179, 8, 0.12)');
        beamGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 220, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - 5);
        ctx.lineTo(screenX + Math.cos(aimAngle) * beamReach, (screenY - 5) + Math.sin(aimAngle) * beamReach);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Bright Yellow / Warm Golden Flare Glow around Deployed Torches
      if (state.torches && state.torches.deployed) {
        for (const torch of state.torches.deployed) {
          const tx = worldOffsetX + torch.x;
          const ty = torch.y - cameraY;
          if (ty < -150 || ty > canvas.height + 150) continue;

          ctx.save();
          const flicker = 1.0 + Math.sin(torch.flickerPhase * 2) * 0.15;
          const radius = (110 + Math.sin(torch.flickerPhase) * 8) * flicker;

          const torchGrad = ctx.createRadialGradient(tx, ty - 6, 4, tx, ty - 6, radius);
          torchGrad.addColorStop(0, 'rgba(255, 240, 138, 0.6)'); // Bright yellow core
          torchGrad.addColorStop(0.4, 'rgba(250, 204, 21, 0.3)');
          torchGrad.addColorStop(0.8, 'rgba(249, 115, 22, 0.1)');
          torchGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');

          ctx.fillStyle = torchGrad;
          ctx.beginPath();
          ctx.arc(tx, ty - 6, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 3. The Light Radius (Vignette) applied last as requested
      const lightRadius = (state.flashlight && state.flashlight.enabled) ? 290 : 210;
      const vignette = ctx.createRadialGradient(screenX, screenY, 40, screenX, screenY, lightRadius);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');     // completely transparent at center
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.95)');  // pitch black at outer radius

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // --- CANVAS RESIZE ---
    function handleResize() {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    
    // --- TOUCH CONTROLS & MOBILE GESTURE SYSTEM ---
    function setupTouchControls() {
      const dpadUp = document.getElementById('btn-touch-up');
      const dpadLeft = document.getElementById('btn-touch-left');
      const dpadRight = document.getElementById('btn-touch-right');
      const dpadDown = document.getElementById('btn-touch-down');

      function bindRepeatButton(el, onAction, onRelease, keyName) {
        if (!el) return;
        let timer = null;

        function start(e) {
          e.preventDefault();
          e.stopPropagation();
          if (soundEnabled) getAudioContext();
          el.classList.add('active');
          if (keyName) keys[keyName] = true;
          onAction();
          clearInterval(timer);
          timer = setInterval(() => {
            onAction();
          }, 110);
        }

        function stop(e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          el.classList.remove('active');
          clearInterval(timer);
          timer = null;
          if (keyName) keys[keyName] = false;
          if (onRelease) onRelease();
        }

        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', stop);
        el.addEventListener('pointercancel', stop);
        el.addEventListener('pointerleave', stop);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      }

      bindRepeatButton(dpadUp, () => triggerThruster(), () => { state.player.isJetpacking = false; }, 'ArrowUp');
      bindRepeatButton(dpadLeft, () => moveDigger(-1, 0), null, 'ArrowLeft');
      bindRepeatButton(dpadRight, () => moveDigger(1, 0), null, 'ArrowRight');
      bindRepeatButton(dpadDown, () => moveDigger(0, 1), null, 'ArrowDown');

      const btnTouchInteract = document.getElementById('btn-touch-interact');
      if (btnTouchInteract) {
        btnTouchInteract.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (soundEnabled) getAudioContext();
          handleInteract();
        });
      }

      const btnTouchFlashlight = document.getElementById('btn-touch-flashlight');
      if (btnTouchFlashlight) {
        btnTouchFlashlight.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFlashlight();
        });
      }

      const btnTouchTorch = document.getElementById('btn-touch-torch');
      if (btnTouchTorch) {
        btnTouchTorch.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleTorchAction();
        });
      }

      // Mobile Surface Panel Drawer Toggle
      const surfacePanel = document.getElementById('surface-panel');
      const mobileBackdrop = document.getElementById('mobile-panel-backdrop');
      const btnToggleMobilePanel = document.getElementById('btn-toggle-mobile-panel');
      const btnCloseMobilePanel = document.getElementById('btn-close-mobile-panel');

      function openMobilePanel() {
        if (surfacePanel) surfacePanel.classList.add('mobile-open');
        if (mobileBackdrop) mobileBackdrop.classList.add('active');
        handleResize();
      }

      function closeMobilePanel() {
        if (surfacePanel) surfacePanel.classList.remove('mobile-open');
        if (mobileBackdrop) mobileBackdrop.classList.remove('active');
        handleResize();
      }

      if (btnToggleMobilePanel) {
        btnToggleMobilePanel.addEventListener('click', () => {
          if (surfacePanel.classList.contains('mobile-open')) {
            closeMobilePanel();
          } else {
            openMobilePanel();
          }
        });
      }

      if (btnCloseMobilePanel) {
        btnCloseMobilePanel.addEventListener('click', closeMobilePanel);
      }

      if (mobileBackdrop) {
        mobileBackdrop.addEventListener('click', closeMobilePanel);
      }

      // Touch Aiming & Flashlight Control on Canvas
      function handleCanvasTouch(e) {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        state.flashlight.mouseX = t.clientX - rect.left;
        state.flashlight.mouseY = t.clientY - rect.top;
        state.flashlight.hasMouse = true;
      }

      canvas.addEventListener('touchstart', handleCanvasTouch, { passive: true });
      canvas.addEventListener('touchmove', handleCanvasTouch, { passive: true });

      // Unlock Audio Context on first touch
      window.addEventListener('touchstart', () => {
        if (soundEnabled) getAudioContext();
      }, { once: true, passive: true });

      window.openMobilePanel = openMobilePanel;
      window.closeMobilePanel = closeMobilePanel;
    }

    setupTouchControls();

    window.addEventListener('resize', handleResize);
    handleResize();

    // --- INITIALIZE GAME ---
    updateUI();
    function gameLoop(time) {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      try {
        update(dt);
        draw();
      } catch (err) {
        console.error("Game loop error:", err);
      }
      if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(gameLoop);
    }
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(gameLoop);

// Node.js test environment export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { state, getTotalRaw, destroyBlock, drillBlock, consumeEnergy, handleInteract, triggerThruster, moveDigger, triggerAbility };
}
