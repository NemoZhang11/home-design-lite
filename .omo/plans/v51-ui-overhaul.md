# v51-ui-overhaul - Work Plan

## TL;DR (For humans)

**What you'll get:** 4-tab redesign replacing the 3-mode system — Room Setup (templates + custom dims), Furniture Selection (quantity-based), Layout Plans (A/B schemes), and Micro-Adjustment (drag/resize/rotate). Plus canvas zoom controls, a context-sensitive status bar, and polished interactions (proper cursors, wall glow, labels, collision rebound, export).

**Why this approach:** Incremental 4-wave build — each wave is independently shippable and doesn't break existing functionality. Wave 1 rebuilds the shell (tabs + canvas controls). Wave 2 adds the first two panels. Wave 3 adds layout + adjustment panels. Wave 4 polishes. All engine/renderer code stays untouched.

**What it will NOT do:** No AI input box, no "next step" buttons, no fake loading animations, no wall-mounted furniture, no multi-room.

**Effort:** Large
**Risk:** Medium — changing the shell while keeping all drawing/furniture logic working
**Decisions to sanity-check:** Layout algorithm uses 2 strategies (wall-hugging + partitioned) not 3; canvas template cards are CSS overlays not Konva shapes, all existing localStorage is cleared on first load.

Your next move: approve this plan, then `$start-work` to begin execution. Full execution detail follows below.

---

> TL;DR (machine): Large, Medium, 4 waves × 8-12 todos, TypeScript + Konva + Vite, HTML/CSS panel rebuild

## Scope
### Must have
- 4-tab header bar replacing 3-mode buttons
- Room setup panel (templates, custom dimensions, manual draw entry)
- Furniture selection panel (quantity controls, 排一下 button, 清空选择)
- Layout plans panel (2 schemes A/B, ← → navigation, 重新排, 恢复默认)
- Micro-adjustment panel (furniture list, undo/redo, restore, add furniture)
- Canvas controls (铺满画布 button, zoom scale [100%], pan via space+drag & middle-mouse)
- Context-sensitive status bar (12 messages)
- Full cursor system (13 states per spec §3.4)
- Wall hover glow, wall length annotations
- Door/window inline labels (🚪80, 🪟150)
- Right-click furniture context menu
- 4px drag dead zone
- Furniture collision detection with auto-bounce
- Selection state preserved across tabs
- Unified 50-step undo/redo stack
- Export dialog with 2x PNG preview
- Empty-state CSS template cards on first open
- No-room tab protection with guidance text
- Existing wall drawing, door/window placement/drag, furniture placement preserved

### Must NOT have (guardrails, anti-slop, scope boundaries)
- DO NOT break existing wall drawing or door/window drag functionality
- DO NOT introduce any framework dependency (no React, Vue, etc.)
- DO NOT modify engine/ modules (geometry, layout, walls, openings, constants, types)
- DO NOT modify renderer/ modules unless extending them for new features
- DO NOT add AI input, numbered steps, or "下一步" buttons
- DO NOT add fake loading animations or skeleton screens
- DO NOT add multi-room support
- DO NOT add wall-mounted furniture markers

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none (manual QA via build + browser check; no unit test framework in project)
- Evidence: `npm run build` must pass (tsc + vite) after each wave; manual visual check via dev server
- Each todo verified by: `npm run build` passes, lsp_diagnostics clean on changed files

## Execution strategy
### Parallel execution waves
- Wave 1 (8 todos): Shell rebuild — HTML/CSS/structure, tabs, canvas controls, status bar. Parallel: HTML structure + CSS + store changes + tab panel module.
- Wave 2 (8 todos): Step 1-2 panels — room setup, furniture selection, ghost preview, template cards. Parallel: step1 + step2 + ghost + template overlay.
- Wave 3 (6 todos): Step 3-4 panels + undo — layout plans, micro-adjustment, unified undo stack. Parallel: step3 + step4 + undo module.
- Wave 4 (10 todos): Polish — cursors, labels, collision, right-click menu, drag dead zone, export. Parallel: cursor + labels + collision + contextMenu + export.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. HTML structure | — | 2,3,4,5 | 6 (CSS) |
| 2. CSS style | 1 | — | 1,3,4,5 |
| 3. Store expansion | — | 8 | 1,2,4,5,6 |
| 4. Tab panel module | 1 | 5,8 | 1,2,3,6 |
| 5. Canvas controls | 1 | — | 1,2,3,4,6 |
| 6. Status bar rewrite | — | — | 1,2,3,4,5 |
| 7. main.ts refactor | 1,2,3,4,5,6 | all wave-2 | — |
| 8. Wave 1 integration/build | 1-7 | — | — |
| 9. Step1 room panel | 8 | — | 10,11,12 |
| 10. Template cards overlay | 8 | — | 9,11,12 |
| 11. Step2 furniture panel | 8 | — | 9,10,12 |
| 12. Ghost preview module | 11 | — | 9,10,11 |
| 13. Wave 2 integration | 9-12 | — | — |
| 14. Step3 layout panel | 13 | — | 15,16,17 |
| 15. Layout algorithm B | 13 | 14 | 16,17 |
| 16. Step4 adjust panel | 13 | — | 14,15,17 |
| 17. Unified undo/redo | 13 | 16 | 14,15,16 |
| 18. Wave 3 integration | 14-17 | — | — |
| 19. Cursor system | 18 | — | 20,21,22,23,24 |
| 20. Wall glow + labels | 18 | — | 19,21,22,23,24 |
| 21. Door/window labels | 18 | — | 19,20,22,23,24 |
| 22. Collision detection | 18 | — | 19,20,21,23,24 |
| 23. Context menu | 18 | — | 19,20,21,22,24 |
| 24. Export dialog | 18 | — | 19,20,21,22,23 |
| 25. Drag dead zone | 18 | — | 19-24 |
| 26. Wave 4 integration | 19-25 | — | — |
| 27. Final build & verify | 26 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.

- [ ] 1. Rebuild HTML structure — index.html with 4-tab header, new sidebar, canvas overlay elements
  What to do / Must NOT do: Replace index.html body with new structure: 4-tab header bar (🏠房间设置/🪑选择家具/✨布局方案/✋微调), sidebar that switches per tab, canvas-wrapper with overlay divs for zoom controls and template cards. Remove AI input, remove mode buttons, remove old building catalog. Keep canvas-stage div. Add new element IDs matching the new modules. DO NOT remove existing canvas-stage or break Konva initialization.
  Parallelization: Wave 1 | Blocked by: — | Blocks: 2,3,4,5
  References: index.html:1-182, design doc §2 layout diagram, §4-7 panel specs
  Acceptance criteria: HTML parses without errors, all required element IDs exist (tab-header, tab-content, canvas-zoom-btn, canvas-zoom-label, status-bar, template-overlay), no references to removed elements in the DOM
  QA scenarios: happy — open in browser, see 4 tabs in header; failure — missing elements cause JS errors in console
  Commit: Y | feat(html): 4-tab shell with canvas overlay elements

- [ ] 2. Rewrite CSS — main.css for 4-tab layout, sidebar, canvas controls, panels
  What to do / Must NOT do: Rewrite main.css for new layout: 240px sidebar, tab header bar with active/available states, canvas overlay positioning (bottom-right zoom controls, centered template cards), sidebar panel content, action buttons, status bar. Follow spec §2 layout diagram. Keep dark title bar style. DO NOT break canvas container sizing.
  Parallelization: Wave 1 | Blocked by: — | Blocks: — (parallel with 1,3,4,5,6)
  References: src/styles/main.css:1-278, design doc §2 layout, §3.1 zoom controls, §4-7 panel layouts
  Acceptance criteria: CSS applies correctly at 1200px+ width, sidebar 240px, tabs styled distinctly, canvas fills remaining space
  QA scenarios: happy — open browser, layout matches spec; failure — layout breaks at common viewport sizes
  Commit: Y | style(css): 4-tab layout, sidebar panels, canvas controls

- [ ] 3. Expand state store — add tab state, unified undo stack, selection persistence
  What to do / Must NOT do: Update src/state/store.ts: replace `mode` with `activeTab: 'room'|'furniture'|'layout'|'adjust'`. Replace `undoStack: Point[][]` with `undoStack: StateSnapshot[]` (full state snapshots, max 50). Add `_noSelectionClearOnTabSwitch` flag. Keep all existing fields (walls, doors, windows, furniture). Update localStorage SaveData to include activeTab. DO NOT change engine types.
  Parallelization: Wave 1 | Blocked by: — | Blocks: 8
  References: src/state/store.ts:1-145, design doc §14 undo spec, §13.5 selection persistence
  Acceptance criteria: TypeScript compiles, store can hold tab state, undo/redo functions work with new snapshot type, localStorage roundtrip includes tab
  QA scenarios: happy — build passes; failure — type errors on removed fields
  Commit: Y | feat(store): activeTab, unified undo stack, selection persistence

- [ ] 4. Create tab panel module — src/ui/stepPanel.ts
  What to do / Must NOT do: New file: manages tab switching. Shows/hides sidebar panels by tab (display:none toggle). Updates header bar active state. Handles tab click events. Exports: setActiveTab(tab), getActiveTab(). When no room exists and user clicks furniture/layout/adjust tab, show guidance text instead of panel content (spec §8.2). DO NOT use mode-based logic.
  Parallelization: Wave 1 | Blocked by: — | Blocks: 5,8
  References: design doc §2 tab behavior, §8.2 no-room protection, §13.5 selection persistence
  Acceptance criteria: Clicking tabs switches panels, active tab is visually distinct, no-room guidance shows for dependent tabs
  QA scenarios: happy — click tab 2-4 without room, see guidance; click tab 1, see room panel; failure — tab switching breaks, panels don't hide
  Commit: Y | feat(ui): tab panel manager with no-room guidance

- [ ] 5. Create canvas controls module — src/ui/canvasControls.ts
  What to do / Must NOT do: New file: implements 铺满画布 button + zoom scale label. Fit algorithm: compute room bounding box → scale to fit canvas with 40px padding → 300ms Konva tween. Zoom scale label updates on wheel and after fit. Pan: space+drag (shift key proxy since space is Konva-ignored) and middle-mouse drag. Clamp zoom 0.2x-4.0x. Exports: initCanvasControls(stage, container, zoomLabel). Also: Ctrl+0 fits; double-click zoom label resets to 100%. DO NOT break existing wheel zoom handler.
  Parallelization: Wave 1 | Blocked by: — | Blocks: — (parallel with 1,2,3,4,6)
  References: src/main.ts:1096-1115 (existing wheel zoom), design doc §3.1-3.3 canvas controls
  Acceptance criteria: Fit button works with and without room, zoom label updates in real-time, Ctrl+0 triggers fit, pan works via middle-mouse
  QA scenarios: happy — create room, click fit, room fills canvas with padding; failure — fit crashes on empty canvas
  Commit: Y | feat(ui): canvas controls — fit, zoom scale, pan

- [ ] 6. Rewrite status bar — src/ui/statusBar.ts with 12 context messages
  What to do / Must NOT do: Update setStatus to accept context key and optional params. Define 12 messages per spec §14 (首次打开无房间, 房间已创建, 手动绘制墙线中, 放置门/窗, 选择家具中, 已选家具未布局, 布局方案浏览中, 微调中, 添加家具放置中, 碰撞发生). Add `updateStatusBarForTab(tab)` helper. Remove old dot indicator or integrate into new style.
  Parallelization: Wave 1 | Blocked by: — | Blocks: — (parallel with 1,2,3,4,5)
  References: src/ui/statusBar.ts:1-13, design doc §14 status bar table
  Acceptance criteria: Each context shows correct message, messages change on tab switch, no hardcoded strings in main.ts
  QA scenarios: happy — switch tabs, verify correct status message; failure — stale messages from wrong context
  Commit: Y | feat(ui): 12-context status bar

- [ ] 7. Refactor main.ts — extract into modules, wire everything
  What to do / Must NOT do: Reduce main.ts to orchestration only (~300 lines). Move tab event binding to stepPanel. Move canvas control event binding to canvasControls. Keep wall drawing logic, door/window creation, furniture placement, layout execution in main.ts but call helper modules for UI. All existing canvas event handlers (click, wheel, keyboard) stay in main.ts. Import and initialize all new modules. DO NOT delete any functional code — only extract UI binding.
  Parallelization: Wave 1 | Blocked by: 1,2,3,4,5,6 | Blocks: all wave-2
  References: src/main.ts:1-1381, new ui/ modules
  Acceptance criteria: Build passes, existing wall drawing works, door/window placement works, furniture drag works
  QA scenarios: happy — all existing interactions work through new tab UI; failure — any broken interaction from extraction
  Commit: Y | refactor(main): extract UI to modules, wire tabs

- [ ] 8. Wave 1 integration — build, test, fix
  What to do / Must NOT do: Run npm run build, fix all type errors. Test in browser: tabs switch, canvas shows, existing drawing works. Verify no regression on wall drawing, door/window placement, furniture. Check lsp_diagnostics on all changed files. DO NOT proceed to Wave 2 until build is clean.
  Parallelization: Wave 1 | Blocked by: 1,2,3,4,5,6,7 | Blocks: all wave-2
  References: all wave-1 files
  Acceptance criteria: npm run build passes, dev server loads without JS errors, wall drawing works, door/window click works
  QA scenarios: happy — full build, no console errors on load; failure — any build error or runtime crash
  Commit: N (integration commit — part of wave)

- [ ] 9. Create Step1 room panel — src/ui/step1Room.ts
  What to do / Must NOT do: New file: room setup panel content. Sections: (1) 快速开始 — 4 template cards (儿童房4×3, 主卧5×4, 书房3×3, 客厅6×4) as clickable cards with emoji+label+size. (2) ✏️自定义尺寸 — width/height inputs + [创建房间] button, Enter to confirm (per spec §4 size-input rules). (3) 当前房间 info line — shows "400×300 cm | 门×1 窗×1". (4) [重置房间] button (shown when room exists). (5) [✏️ 手动绘制墙线] button. Template switch with existing room → confirm dialog. Exports: renderStep1Panel(container). Use ROOM_TEMPLATES from main.ts or redefine here.
  Parallelization: Wave 2 | Blocked by: 8 | Blocks: — (parallel with 10,11,12)
  References: design doc §4 full panel spec, src/main.ts:46-98 (ROOM_TEMPLATES), src/ui/toolbar.ts:76-104 (create room logic)
  Acceptance criteria: Template cards render, clicking creates room, custom dims form works with Enter, reset clears room, manual draw activates wall drawing
  QA scenarios: happy — click template, room appears; failure — template click does nothing
  Commit: Y | feat(ui): step1 room setup panel

- [ ] 10. Create first-open template cards overlay — CSS cards on canvas
  What to do / Must NOT do: Add HTML overlay div (#template-overlay) over canvas area. Show 4 template cards (centered, large rounded corners, shadows) when no room exists. Cards match step1 panel templates. Clicking a card creates the room and hides the overlay. Also show "或自定义尺寸" text below cards. Match spec §11 "首次打开" description. Cards use pure CSS (no JS framework). DO NOT overlap with canvas controls (bottom-right).
  Parallelization: Wave 2 | Blocked by: 8 | Blocks: — (parallel with 9,11,12)
  References: design doc §11 empty state, index.html template section
  Acceptance criteria: Cards appear on empty canvas, clicking creates room, overlay hides after creation
  QA scenarios: happy — first open, see 4 centered cards; failure — cards overlap zoom controls
  Commit: Y | feat(ui): canvas template cards overlay for first-open

- [ ] 11. Create Step2 furniture panel — src/ui/step2Furniture.ts
  What to do / Must NOT do: New file: furniture selection panel. List 5 furniture types (bed 160×200, desk 120×60, wardrobe 100×60, chair 40×40, sofa 180×80). Each row: emoji+name+size + [数字输入 0-99] + [+] button (≥32px click area per spec §5). Bottom: "已选: 床×1 衣柜×1 椅子×2" summary line. [✨ 排一下 (N件)] button (enabled when ≥1 selected). [清空选择] button — resets all to 0. Clicking "排一下" triggers layout and switches to step3 tab. Quantity changes update canvas ghost preview. DO NOT hardcode furniture — use FURNITURE_DEFS from constants.
  Parallelization: Wave 2 | Blocked by: 8 | Blocks: — (parallel with 9,10,12)
  References: design doc §5 full panel spec, src/engine/constants.ts:33-39 (FURNITURE_DEFS)
  Acceptance criteria: [+] increments, number input works, 排一下 enabled/disabled, 清空选择 resets all
  QA scenarios: happy — click [+] 3 times on bed, see 已选: 床×3; failure — 排一下 clickable with 0 selections
  Commit: Y | feat(ui): step2 furniture selection panel

- [ ] 12. Create ghost preview module — src/ui/ghostPreview.ts
  What to do / Must NOT do: New file: manages ghost preview for door/window/furniture placement. Already partially done in previewLayer.ts — extend to furniture. When placing furniture (after [+ 添加家具] in step4), show semi-transparent outline at mouse position. When door/window placement active, show preview on nearest wall. Show collision state (green=ok, red=overlap). Exports: showFurnitureGhost(type, x, y, rotation), hideGhost(). Uses existing previewLayer Konva layer. DO NOT duplicate previewLayer.ts — extend it.
  Parallelization: Wave 2 | Blocked by: 11 | Blocks: — (parallel with 9,10)
  References: src/renderer/previewLayer.ts, src/main.ts:969-981 (existing ghost), design doc §7 ghost preview
  Acceptance criteria: Ghost appears on mousemove during placement, hides on click/esc, shows red for collision
  QA scenarios: happy — enter placement mode, see ghost follow cursor; failure — ghost doesn't hide after placement
  Commit: Y | feat(ui): ghost preview for furniture placement

- [ ] 13. Wave 2 integration — build, test, fix
  What to do / Must NOT do: npm run build, fix type errors. Test: create room via template, select furniture quantities, click 排一下. Verify templates, custom dims, manual draw all work. DO NOT proceed to Wave 3 until build is clean.
  Parallelization: Wave 2 | Blocked by: 9,10,11,12 | Blocks: all wave-3
  References: all wave-2 files
  Acceptance criteria: Build passes, room creation works from panel, furniture selection UI works
  QA scenarios: happy — full flow: template → furniture → layout; failure — any crash in panel interaction
  Commit: N

- [ ] 14. Create layout algorithm B — parallel variant in engine/layout.ts
  What to do / Must NOT do: Add second layout strategy to src/engine/layout.ts. Strategy A (existing): wall-hugging — place furniture along walls with gap. Strategy B (new): partitioned — divide room into zones (sleep, work, storage), place items in assigned zones. Export: runSmartLayout(points, items, strategy) with strategy='A'|'B'. Keep existing function signature for backward compat. DO NOT change strategy A behavior. DO NOT make strategy C (centered).
  Parallelization: Wave 3 | Blocked by: 13 | Blocks: 15 (step3 panel)
  References: src/engine/layout.ts:1-120, design doc §6 layout schemes
  Acceptance criteria: Strategy A produces same results as before, strategy B produces non-overlapping positions, both run in <50ms
  QA scenarios: happy — run B on 5 furniture items, get non-overlapping positions; failure — B crashes or overlaps
  Commit: Y | feat(layout): dual-strategy layout (A: wall-hugging, B: partitioned)

- [ ] 15. Create Step3 layout panel — src/ui/step3Layout.ts
  What to do / Must NOT do: New file: layout plans panel. Shows 2 scheme cards (方案A ★推荐, 方案B). Each card: radio-style selector, 大白话 description ("家具贴墙放，中间宽敞" / "分区布局，动静分离"), status line (✓通道65cm ✓床不靠窗 / ⚠衣柜贴窗边). [🔄 重新排一下] button. [↺ 恢复默认] button (when user adjusted). ←→ arrow keys switch schemes. Canvas edge arrows (hover visible). Clicking card switches furniture positions with 400ms ease-out tween. DO NOT add scheme C.
  Parallelization: Wave 3 | Blocked by: 14 | Blocks: — (parallel with 16,17)
  References: design doc §6 full panel spec, src/main.ts:740-778 (smart layout execution)
  Acceptance criteria: 2 scheme cards render, clicking switches furniture on canvas, ← → keys work, 重新排 produces new layout
  QA scenarios: happy — click 方案B, furniture moves to new positions; failure — switching doesn't animate
  Commit: Y | feat(ui): step3 layout plans panel with dual schemes

- [ ] 16. Create Step4 adjust panel — src/ui/step4Adjust.ts
  What to do / Must NOT do: New file: micro-adjustment panel. Shows list of placed furniture items with radio selection, name+size+rotation. Selecting highlights on canvas. Each row: ○ 🛏️ 床 160×200 0°. Bottom: [+ 添加家具] button (enters placement mode with ghost preview). ↩撤销 / ↪重做 / [↺ 恢复] buttons. "← 回去看方案" link. Clicking furniture in list selects it on canvas. Clicking on canvas selects it in list. Rotation shows drag handle on canvas (top circle).
  Parallelization: Wave 3 | Blocked by: 13 | Blocks: — (parallel with 14,15,17)
  References: design doc §7 full panel spec, src/renderer/furnitureLayer.ts (existing drag/rotation)
  Acceptance criteria: Furniture list shows placed items, clicking selects on canvas, 恢复 resets to layout origin, add furniture enters ghost mode
  QA scenarios: happy — select wardrobe in list, see blue selection on canvas; failure — list empty after layout
  Commit: Y | feat(ui): step4 micro-adjustment panel

- [ ] 17. Implement unified undo/redo — 50-step stack
  What to do / Must NOT do: Replace wall-only undo with full-state snapshots. Define StateSnapshot type containing all mutable state (walls, doors, windows, furniture, selected tips). On every significant action (wall point add, door/window create/move/resize/delete, furniture place/move/rotate/delete, layout apply), push snapshot. Max 50, discard oldest. Ctrl+Z/Ctrl+Y work across all tabs. DO NOT record snapshots during drag (record on drag-end). DO NOT record during text input (record on Enter/blur).
  Parallelization: Wave 3 | Blocked by: 13 | Blocks: — (parallel with 14,15,16)
  References: src/state/store.ts:55-76 (current undo/redo), design doc §14 undo spec
  Acceptance criteria: Ctrl+Z reverts any operation (wall, door, furniture), 50-step limit, cross-tab undo works
  QA scenarios: happy — place door, undo, door disappears; failure — Ctrl+Z does nothing after furniture move
  Commit: Y | feat(undo): unified 50-step cross-tab undo/redo

- [ ] 18. Wave 3 integration — build, test, fix
  What to do / Must NOT do: npm run build, fix type errors. Test full flow: room → furniture select → layout → adjust → undo. Verify both layout strategies produce valid positions. DO NOT proceed to Wave 4 until build is clean.
  Parallelization: Wave 3 | Blocked by: 14,15,16,17 | Blocks: all wave-4
  Acceptance criteria: Build passes, layout generates 2 schemes, adjust panel works, undo reverts operations
  QA scenarios: happy — full flow from room creation to micro-adjustment; failure — any crash in layout or adjust
  Commit: N

- [ ] 19. Implement full cursor system — 13 states
  What to do / Must NOT do: Update cursor management across all interactions. Per spec §3.4 table: default in empty canvas, grab/grabbing for pan, pointer for walls/arcs/buttons, crosshair for wall drawing, grab for door/window/furniture hover, ew-resize for resize handles, grabbing during drag, copy for placement mode. Set via stage.container().style.cursor in appropriate event handlers (mouseenter/mouseleave on Konva groups, mousemove on stage, keyboard events for space/esc). DO NOT change cursor during fast drag (performance).
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 20-25)
  References: design doc §3.4 cursor table, src/main.ts:839-849 (existing mode cursor), src/renderer/doorLayer.ts:115-117 (existing door grab)
  Acceptance criteria: Each of 13 cursor states appears in correct context, no incorrect cursors linger
  QA scenarios: happy — hover wall → pointer, drag door → grabbing, placement → copy; failure — wrong cursor shown
  Commit: Y | feat(cursor): 13-state cursor system per design spec

- [ ] 20. Wall hover glow + length labels — wallLayer.ts extensions
  What to do / Must NOT do: Add wall hover glow: on mouseenter of wall-body, add 2px light blue shadow/glow effect to the wall rect. On mouseleave, remove. Only on closed rooms. Add wall length label: Konva.Text on each wall segment at midpoint, perpendicular offset 20px outward, font 11px gray, content like "400cm". Label rotation matches wall angle but text stays upright (or parallel). DO NOT modify wall segment data structure. DO NOT show labels for disconnected wall segments.
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 19,21-25)
  References: design doc §15.1 wall hover glow, §15.2 length labels, src/renderer/wallLayer.ts
  Acceptance criteria: Hover wall → blue glow visible, labels show on all wall segments, labels readable at various zoom levels
  QA scenarios: happy — 4 walls, each shows label "400cm" or similar; failure — labels overlap or unreadable
  Commit: Y | feat(render): wall hover glow + segment length labels

- [ ] 21. Door/window inline labels — doorLayer.ts extensions
  What to do / Must NOT do: Add Konva.Text labels to door and window groups: "🚪80" on doors, "🪟150" on windows. Position: centered above/below the element, font 10px, dark gray. Labels move and rotate with the element. Update label text when width changes. Hide labels when element not selected AND zoom < 0.5 (avoid clutter). DO NOT add labels to resize handles or arc lines.
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 19,20,22-25)
  References: design doc §15.3 door/window inline labels, src/renderer/doorLayer.ts
  Acceptance criteria: Door shows 🚪80, window shows 🪟100, labels update on width change, hidden at low zoom
  QA scenarios: happy — adjust door width to 120, label updates to 🚪120; failure — label doesn't update
  Commit: Y | feat(render): door/window inline width labels

- [ ] 22. Furniture collision detection + auto-bounce
  What to do / Must NOT do: Wire collision detection to furniture drag. On dragmove: check if furniture overlaps any other furniture or room boundary. If overlapping → red semi-transparent outline on both items. On dragend: if still overlapping → tween back to last valid position (250ms ease-out). Room boundary: furniture center must stay inside room polygon. Door/window exclusion zones: no furniture within 80px of door hinge. Use existing collides() and insideRoom() from engine/layout.ts. DO NOT block placement — only warn and auto-bounce.
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 19,20,21,23-25)
  References: src/engine/layout.ts:10-30 (collision functions), src/renderer/furnitureLayer.ts drag handlers, design doc §7 collision, §9.3 door/window exclusion
  Acceptance criteria: Overlapping furniture turns red during drag, auto-bounces on invalid drop, room boundary respected
  QA scenarios: happy — drag bed into wardrobe, both turn red, release = bed bounces back; failure — can drag furniture outside room
  Commit: Y | feat(furniture): collision detection with auto-bounce

- [ ] 23. Right-click context menu — src/ui/contextMenu.ts
  What to do / Must NOT do: New file: HTML overlay div for right-click menu on furniture. Shows 3 items: 旋转90° / 编辑尺寸... / 删除. Positioned at mouse coordinates. Clicking 旋转90° rotates furniture 90° clockwise. Clicking 编辑尺寸 opens inline dimension input (double-click behavior). Clicking 删除 removes furniture. Menu closes on click outside or Esc. DO NOT use browser native contextmenu. DO NOT show on non-furniture elements.
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 19,20,21,22,24,25)
  References: design doc §15.4 right-click menu, src/main.ts:308-325 (existing wall contextmenu)
  Acceptance criteria: Right-click furniture → 3-item menu, clicking item performs action, click-away closes
  QA scenarios: happy — right-click bed, click 删除, bed removed; failure — menu appears in wrong position
  Commit: Y | feat(ui): right-click context menu for furniture

- [ ] 24. Export dialog — 2x PNG preview + download
  What to do / Must NOT do: Add export button in header bar. Click → show modal with canvas preview thumbnail + checkboxes (房间/家具/标注) + [导出 PNG] button. Export: render Konva stage to 2x resolution data URL, trigger download as "房间布局.png". Export always shows full room (not viewport crop) — use toDataURL with pixelRatio:2 on the stage after scaling to fit. DO NOT require backend. DO NOT add PDF or other formats.
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 19,20,21,22,23,25)
  References: design doc §7 export section, Konva stage.toDataURL() API
  Acceptance criteria: Export button → modal → preview → download PNG, file is 2x resolution, shows full room
  QA scenarios: happy — export, open PNG, see full room at 2x; failure — PNG is cropped or low-res
  Commit: Y | feat(export): 2x PNG export with preview modal

- [ ] 25. Drag dead zone — 4px threshold
  What to do / Must NOT do: Add 4px drag dead zone to ALL draggable elements (furniture, doors, windows). On dragstart, store start position. On dragmove, if distance < 4px, suppress drag (don't update position). Only after 4px threshold, enter full drag mode. This prevents accidental micro-drags on click. Apply uniformly: furniture drag, door/window wall-slide, resize handles. DO NOT add dead zone to canvas pan or zoom.
  Parallelization: Wave 4 | Blocked by: 18 | Blocks: — (parallel with 19-24)
  References: design doc §15.6 drag dead zone, src/renderer/furnitureLayer.ts, src/renderer/doorLayer.ts
  Acceptance criteria: Click on furniture doesn't move it, drag > 4px activates properly, no lag in threshold detection
  QA scenarios: happy — click furniture, no movement; drag slowly, activates at 5px; failure — click causes 1px jitter
  Commit: Y | feat(drag): 4px dead zone on all draggable elements

- [ ] 26. Wave 4 integration — final build and polish
  What to do / Must NOT do: npm run build, fix all type errors. Run lsp_diagnostics on all changed files. Verify all 4 waves work together. Test full user journey. DO NOT proceed to final verification until build is clean and all features work.
  Parallelization: Wave 4 | Blocked by: 19,20,21,22,23,24,25 | Blocks: 27
  Acceptance criteria: Zero build errors, zero lsp diagnostics on changed files, full manual walkthrough passes
  QA scenarios: happy — complete flow without errors; failure — any regression or broken feature
  Commit: N

- [ ] 27. Final build & verify — production build + manual QA checklist
  What to do / Must NOT do: Run `npm run build` for production. Verify: (1) all 4 tabs switch correctly, (2) room creation from template + custom dims + manual draw, (3) furniture selection → layout → adjust, (4) canvas controls work, (5) cursors correct, (6) undo/redo across tabs, (7) export produces valid PNG, (8) no console errors. DO NOT skip any QA check.
  Parallelization: Final | Blocked by: 26 | Blocks: —
  Acceptance criteria: Production build succeeds, all 8 QA checks pass, no console errors
  QA scenarios: happy — all checks pass; failure — any check fails → return to relevant wave and fix
  Commit: Y | build: production-ready v5.1

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — verify all 27 todos completed, all scope-IN delivered, no scope-OUT crept in
- [ ] F2. Code quality review — check no `as any`, `@ts-ignore`, empty catch blocks; all new modules follow existing patterns
- [ ] F3. Real manual QA — walk through full user journey: new user → template → furniture → layout → adjust → export
- [ ] F4. Scope fidelity — verify design doc §4-15 features against implementation; note any deviations

## Commit strategy
- Atomic commits per wave (1 commit per todo group)
- Wave boundary commits are integration points
- Final commit tagged as v5.1
- Commit messages in conventional format: feat|fix|refactor|style|build(scope): description

## Success criteria
1. All 4 tabs functional with correct content switching
2. Room creation: templates, custom dims, manual draw all work
3. Furniture selection with quantity control, 排一下 triggers layout
4. Layout generates 2 distinct schemes, switchable via click and keyboard
5. Micro-adjustment drag, rotate, resize, undo all work
6. Canvas controls: fit, zoom scale, pan
7. Cursor system: all 13 states correct
8. Wall labels, door/window labels, wall glow visible
9. Collision detection shows red + auto-bounces
10. Right-click menu: 3 items functional
11. 50-step undo/redo across all operations
12. Export produces valid 2x PNG
13. Zero TypeScript errors, zero console errors
14. Existing wall drawing, door/window drag, furniture placement preserved
