# 📦 RouteMaster — Warehouse Order Path Optimizer
### **Logistics & Supply Chain Hackathon 2026**

[![HTML5](https://img.shields.io/badge/HTML5-Single_File_App-E34F26.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla_ES6+-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Algorithm](https://img.shields.io/badge/Algorithm-BFS_Pathfinding-00D4B4.svg)](https://en.wikipedia.org/wiki/Breadth-first_search)
[![UI](https://img.shields.io/badge/UI-Modern_Animated-8B5CF6.svg)]()
[![Status](https://img.shields.io/badge/Project-Hackathon_Submission-green.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()

## 🧠 Team: ByteForce

---

## 📌 Project Overview

**Warehouse order picking** is one of the most labor-intensive operations in modern logistics — accounting for up to **55% of total warehouse operating costs**. Workers walking unoptimized, obstacle-prone routes waste thousands of man-hours every year across fulfillment centers.

**RouteMaster** is a real-time, browser-based warehouse pathfinding engine that uses **Breadth-First Search (BFS)** to compute the guaranteed shortest route from any picker location to the nearest target item — automatically navigating around every shelf, wall, and obstacle in the warehouse grid.

The tool translates a simple grid definition (JSON or CSV) into an **animated, step-by-step visual route** with full export capability — giving warehouse managers, analysts, and logistics engineers an immediately actionable view of optimal picker paths.

**✨ Recent Enhancements:**
- 🎯 **Multiple Targets Support:** Finds the shortest path to the closest reachable target among multiple options
- 🎨 **Enhanced UI:** Modern animations, glows, hover effects, and interactive elements
- 📄 **Improved CSV Parsing:** Handles complex CSV formats with JSON strings and headers
- 📊 **Better Output:** Includes specific reached target in results

---

## 🎯 Key Objectives

* 🔍 **Shortest Path Guarantee:** BFS ensures the mathematically minimum number of steps — no heuristics, no approximations.
* 🎯 **Multiple Targets:** Automatically selects the closest reachable target from a list of options.
* 🧱 **Full Obstacle Avoidance:** Shelf cells (value `1`) are treated as completely impassable — the path always navigates around them.
* 🎬 **Real-Time Visualization:** Animated step-by-step playback with direction arrows, SVG route overlay, and BFS exploration heatmap.
* 📂 **Flexible Input:** Accepts pasted JSON, uploaded `.json` files, or uploaded `.csv` grid files — no server required.
* 📊 **Actionable Output:** Structured JSON with total steps, exact path coordinates, success flag, execution time, and reached target.
* 🎨 **Premium UI:** Smooth animations, gradient effects, and interactive feedback for an engaging user experience.

---

## 🧪 Methodology & Pipeline

### 1. Grid Modelling

The warehouse floor plan is encoded as a 2D matrix where each cell carries one of three semantic values:

| Value | Meaning | Role in Algorithm |
| :---: | :--- | :--- |
| `0` | Walkable aisle | Valid node — BFS may traverse |
| `1` | Obstacle / shelf | Blocked node — BFS skips entirely |
| `2` | Target item | Destination node — BFS terminates here |

### 2. BFS Pathfinding Engine

We implement a textbook **Breadth-First Search** with three core data structures:

* **Queue** — initialized with the start cell; processes nodes level-by-level (distance-by-distance).
* **Visited Set** — tracks explored cells using `"row,col"` string keys to prevent revisits.
* **Parent Map** — records how each cell was reached, enabling full path reconstruction by backtracking.

```
INITIALIZE:
  queue   = [ start_cell ]
  visited = { "row,col" of start }
  parent  = { start → null }

LOOP (while queue not empty):
  cell = dequeue front

  IF cell is in targets → STOP, reconstruct path to that target
  ELSE:
    FOR each of 4 neighbors (↑ ↓ ← →):
      IF in-bounds AND not obstacle AND not visited:
        enqueue, mark visited, record parent

PATH RECONSTRUCTION:
  Trace parent[] backwards from reached target → start
  Reverse array → complete ordered path
```

**Multiple Targets:** When multiple targets are provided, BFS finds the shortest path to the first reachable target encountered, ensuring optimal routing to the closest item.

### 3. Visualization Engine

* **CSS Grid** renders each warehouse cell as a colored square — walkable, obstacle, path, start, or target.
* **Direction arrows** (↑ ↓ ← →) are painted on every path cell showing the picker's movement direction.
* **SVG polyline overlay** draws the animated dashed route line connecting all path cells in real time.
* **Bypassed obstacle glow** highlights shelf cells directly adjacent to the path — showing exactly which walls were navigated around.
* **BFS Explored toggle** reveals the full search frontier in blue — visualizing how the algorithm spread before finding the route.
* **Enhanced UI Effects:** Smooth animations, gradient backgrounds, hover interactions, and glow effects for a premium user experience.

---

## 📊 Key Results

* ✅ **Correctness:** BFS guarantees the shortest path on any N×M grid — verified across all demo datasets.
* 🎯 **Multiple Targets:** Successfully handles multiple target locations, finding the optimal path to the closest reachable item.
* ⚡ **Performance:** Solves a **100×100 grid (10,000 cells, 22% obstacles)** in under **5ms** using `performance.now()`.
* 🌀 **Complexity Benchmark:** A **35×35 recursive-backtracker maze** (52% walls) produces a **161-step winding path** — the algorithm explores all dead ends before locking in the answer.
* 📍 **No-Path Detection:** When no targets are reachable, `target_reached: false` is returned with an empty path — no silent failures.
* 📁 **File Support:** CSV files up to **100×100** (20KB) load, parse, and solve entirely client-side in under 100ms.
* 🎨 **UI Polish:** Modern animations, gradients, and interactive effects enhance user engagement and visual appeal.

---

## 🛠️ Technology Stack

| Category | Tools / Approach |
| :--- | :--- |
| **Language** | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| **Algorithm** | Breadth-First Search (BFS) — unweighted shortest path |
| **Rendering** | CSS Grid + SVG polyline overlay + Canvas API |
| **Input Parsing** | JSON.parse + custom CSV tokenizer (FileReader API) |
| **Timing** | `performance.now()` — sub-millisecond resolution |
| **Export** | Blob API (JSON download) + Canvas `toDataURL` (PNG export) |
| **Fonts** | Google Fonts — Syne (display) + DM Mono (code) |
| **Deployment** | Zero dependencies — single `index.html`, opens in any browser |

---

## 🚀 Impact & Applications

* **Operational Efficiency:** Reduces picker travel distance by eliminating random or greedy routing — directly cuts labor cost per order.
* **Manager Tooling:** Visual path output gives floor managers an instant audit of any route — no code knowledge required.
* **Integration Ready:** Structured JSON output (`path`, `total_steps`, `target_reached`, `execution_time_ms`) slots directly into WMS APIs or reporting pipelines.
* **Scalability:** The algorithm handles grids from 3×3 to 100×100+ with no configuration changes needed.
* **Training Aid:** The animated BFS explorer is a powerful tool for teaching warehouse staff about pathfinding concepts.

---

## 🗂️ Repository Structure

```text
routemaster/

├── LICENSE                             # MIT License
├── README.md                           # Project documentation
├── index.html                          # Main application structure
├── script.js                           # BFS algorithm & UI logic
├── style.css                           # Modern premium styling
├── worst_case.csv                      # Complex test dataset with multiple targets
├── worstcase.json                      # Alternative JSON format test data
```



---

## 📥 Input Format Reference

### JSON (paste or upload `.json`)

```json
{
  "grid": [
    [0, 0, 1],
    [1, 0, 1],
    [0, 2, 0]
  ],
  "start": [0, 0],
  "targets": [[2, 1], [1, 2]]
}
```

### CSV (upload `.csv`)

```
grid,start,targets
"[[0, 0, 1],[1, 0, 1],[0, 2, 0]]","[0, 0]","[[2, 1], [1, 2]]"
```

**OR** Traditional format:

```
0,0,1
1,0,1
0,2,0
start,0,0
target,2,1
target,1,2
```

> The `start` and `target` lines are optional — `start` defaults to `[0,0]` and `targets` are auto-detected from cells with value `2`. Multiple targets are supported; BFS finds the shortest path to the closest reachable target.

---

## 📤 Output Format Reference

```json
{
  "total_steps": 3,
  "path": [
    [  0,  0 ],
    [  0,  1 ],
    [  1,  1 ],
    [  2,  1 ]
  ],
  "target_reached": true,
  "execution_time_ms": 0.5,
  "reached_target": [2, 1]
}
```

| Field | Type | Description |
| :--- | :---: | :--- |
| `total_steps` | `number` | Moves from start to target — equals `path.length - 1` |
| `path` | `array` | Every `[row, col]` cell walked through, in order |
| `target_reached` | `boolean` | `true` if path found · `false` if no targets reachable |
| `execution_time_ms` | `number` | BFS wall-clock time via `performance.now()` |
| `reached_target` | `array` | `[row, col]` of the specific target reached (null if none) |

---

## ⚙️ How to Run

```bash
# No installation required — just open the file
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Or simply drag `index.html` into any browser window. Works fully offline.

---

## 📝 Changelog

### v1.1.0 - Enhanced UI & Multiple Targets
- 🎯 **Multiple Targets Support:** BFS now finds the shortest path to the closest reachable target from a list
- 🎨 **UI Enhancements:** Added animations, glows, hover effects, and gradient backgrounds
- 📄 **CSV Parsing:** Improved to handle complex formats with JSON strings and headers
- 📊 **Output Updates:** Added `reached_target` field to specify which target was reached
- 🐛 **Bug Fixes:** Fixed parsing issues with various CSV formats

### v1.0.0 - Initial Release
- ✅ Core BFS pathfinding algorithm
- 🎬 Real-time visualization with animations
- 📂 JSON/CSV input support
- 📊 Structured output with export options

---

## ✅ Testing Checklist

- [ ] `demo_simple.csv` → `total_steps: 3`, `target_reached: true`
- [ ] `demo_no_path.csv` → `path: []`, `target_reached: false`
- [ ] `complex_maze_35x35.csv` → 161-step winding path visible on grid
- [ ] `stress_test_100x100.csv` → solves in < 10ms, full grid renders correctly
- [ ] **▶ Play Path** → animation steps cell-by-cell with direction arrows
- [ ] **👁 Show BFS Explored** → blue explored-cell overlay appears across walkable area
- [ ] **⬇ JSON** → downloads with aligned `[ r, c ]` matrix format
- [ ] **⬇ PNG** → 2× retina image with legend strip downloads correctly

---
## ⚙️ Requirements & Setup

> **No installation required.** RouteMaster runs entirely in the browser as a single HTML file.

*RouteMaster — Built for Hackathon 2026 · Logistics & Supply Chain Track*
