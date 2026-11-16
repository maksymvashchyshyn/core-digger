# ⛏️ Core Digger // Subterranean Mining Sim

[![CI Test Suite](https://github.com/maksymvashchyshyn/core-digger/actions/workflows/test.yml/badge.svg)](https://github.com/maksymvashchyshyn/core-digger/actions/workflows/test.yml)
[![Live Demo](https://img.shields.io/badge/Play%20Now-GitHub%20Pages-brightgreen?logo=github)](https://maksymvashchyshyn.github.io/core-digger/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS%20%2B%20HTML5%20Canvas-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

> A fast-paced, stylized 2D Canvas incremental mining game inspired by classics like *Motherload* and *Rock Bottom*. Built with Vanilla JavaScript, HTML5 Canvas, Web Audio API, and zero external dependencies.

🎮 **[Play Core Digger in your browser](https://maksymvashchyshyn.github.io/core-digger/)**

---

## 🚀 Key Features

- **Stylized Canvas Graphics:** Procedurally generated subterranean strata (Dirt, Granite, Basalt, Deepslate, Gold, Iron, Cobalt) rendered with custom Canvas gradients, cracks, and particle dynamics.
- **Realistic Excavation Physics:** Gravity falling, continuous auger drill rotation, camera shake, and momentum dampening.
- **Atmospheric Lighting:** Dynamic darkness vignette that deepens with depth, featuring a high-beam floodlight and deployable/retrievable glowing torch beacons.
- **Physical Surface Base Stations:**
  - 🔋 **Refuel Charging Pad:** Restores reactor core output to 100%.
  - 🔥 **The Smelter:** Loads raw ores and smelts them into bouncing ingots with animated progress.
  - 🏪 **The Merchant:** Upgrades Drill Auger Power, Backpack Storage Cargo, Reactor Batteries, and Torch capacity.
- **Active Tactical Abilities:**
  - `[1]` **Dynamite:** Drops a timed blinking explosive shattering a 3x3 subterranean grid.
  - `[2]` **Core Laser:** Fires a high-energy neon beam vaporizing 5 blocks vertically below.
  - `[3]` **Rocket Drill:** Launches a ballistic drill projectile penetrating 4 blocks before a 2x2 detonation.
- **Full Mobile & Touch Support:**
  - On-screen tactile **Virtual D-Pad** with auto-repeat.
  - Dynamic **`[E]` Action Button** that contextually morphs when near stations (`REFUEL`, `SMELT`, `SHOP`, `PICKUP`).
  - Mobile slide-over Base Drawer with quick-toggle button and backdrop dimmer.
  - Touch aiming for flashlight navigation.
- **Synthesized Audio Engine:** Pure procedural Web Audio synthesis for drilling, rock shattering, ore dinging, thrusters, explosions, and reactor humming.

---

## 🕹️ Controls Guide

### Desktop (Keyboard & Mouse)
| Key | Action |
| :--- | :--- |
| <kbd>A</kbd> / <kbd>D</kbd> or <kbd>◀</kbd> / <kbd>▶</kbd> | Move Left / Right |
| <kbd>W</kbd> or <kbd>▲</kbd> | Fire Jetpack Thrusters (Fly Up) |
| <kbd>S</kbd> or <kbd>▼</kbd> | Drill Downward |
| <kbd>E</kbd> | Interact with Surface Base Station / Retrieve Torch |
| <kbd>F</kbd> | Toggle High-Beam Floodlight |
| <kbd>T</kbd> | Deploy Reusable Flare / Torch Beacon |
| <kbd>1</kbd> | Deploy Dynamite (10 Energy) |
| <kbd>2</kbd> | Fire Core Laser (25 Energy) |
| <kbd>3</kbd> | Launch Rocket Drill (40 Energy) |
| **Mouse Drag** | Aim Floodlight Direction |

### Mobile & Tablets (Touch Controls)
- **Virtual D-Pad (Bottom-Left):** Hold ▲ to thrust, ◀/▶ to move, ▼ to drill.
- **Context Action Button (Bottom-Right):** Tapping `[E]` recharges energy, loads the smelter, or opens the Merchant shop.
- **Utility Buttons:** Quick-taps for `[🔦 LIGHT]` and `[🔥 FLARE]`.
- **Base Drawer Button (Top-Right):** `[🎒 CARGO]` toggles between the mine and the base.

---

## 📁 Project Architecture

```
core-digger/
├── index.html               # Clean HTML5 entry point & UI scaffolding
├── css/
│   └── style.css            # Styles, design tokens, HUD telemetry, mobile drawer & touch controls
├── js/
│   ├── audio.js             # Synthesized procedural Web Audio system
│   ├── constants.js         # Block definitions, tiers, stations, and world configuration
│   └── game.js              # State machine, physics, mining, rendering, abilities & touch controls
├── test/
│   └── game.test.js         # Automated unit test suite (Node.js test runner)
├── .github/
│   └── workflows/
│       └── test.yml         # GitHub Actions CI workflow (Runs on push & PR)
├── package.json             # NPM project metadata & test scripts
└── README.md                # Documentation & quick start guide
```

---

## 🧪 Running Tests Locally

Core Digger utilizes Node's built-in test runner (`node:test` and `node:assert`) with zero external dependencies:

```bash
# Run unit test suite
npm test
```

Test coverage includes:
- ✅ Block HP & drop mappings
- ✅ Reactor energy consumption & thruster propulsion
- ✅ Mining drops & cargo capacity limits
- ✅ Physical surface station interactions & smelting queues
- ✅ Active ability stats & cooldowns
- ✅ Reusable torch beacon mechanics

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
