---
slug: v51-ui-overhaul
status: drafting
intent: clear
review_required: false
pending-action: write .omo/plans/v51-ui-overhaul.md
approach: Incremental 4-waves: Wave 1 rebuilds shell (tabs, canvas controls, status bar). Wave 2 rebuilds Step 1-2 panels (room setup, furniture selection). Wave 3 adds Step 3-4 panels (layout plans, micro-adjustment). Wave 4 polishes (cursors, labels, collision, export). Each wave is independently shippable.
---

# Draft: v51-ui-overhaul

## Components (topology ledger)
| id | outcome | status | evidence path |
|----|---------|--------|---------------|
| C1-shell | 4-tab header bar + canvas overlay controls + status bar | active | design doc §2, §3, §14 |
| C2-step1 | Room setup panel (templates, custom dims, manual draw) | active | design doc §4 |
| C3-step2 | Furniture selection panel (quantity, 排一下, ghost) | active | design doc §5 |
| C4-step3 | Layout plans panel (3 schemes, switching, restore) | active | design doc §6 |
| C5-step4 | Micro-adjustment panel (furniture list, undo/redo, restore) | active | design doc §7 |
| C6-canvas | Fit-to-canvas, zoom scale display, pan controls, cursor system | active | design doc §3, §13 |
| C7-ux | Wall glow, length labels, door/window labels, right-click menu, drag dead zone | active | design doc §15 |
| C8-collision | Collision detection, auto-bounce, red outline | active | design doc §7, §9 |
| C9-undo | Unified 50-step undo/redo across all tabs | active | design doc §14 |
| C10-export | Export dialog with preview, 2x PNG output | active | design doc §7 |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|-----------------|-----------|-------------|
| Layout algorithm: multi-scheme | Extend existing engine with parameter variation (wall-hugging, centered, partitioned) | spec says "3方案A/B/C"; current engine has 1 route | yes |
| Right-click context menu | HTML div overlay at pointer position | Konva doesn't have native menu; HTML is simplest | yes |
| Room dimension input | Enter to confirm (per spec §4 size-input rules) | explicit in spec; different from door-width debounce | no (spec-mandated) |
| Tab visibility when no room | Show empty guidance; don't block access | spec §8.2: "标签可以点进去，面板显示引导" | no (spec-mandated) |
| Existing functionality preservation | Keep wall drawing, door/window drag, furniture drag — add new UI on top | backbone is solid; don't break working features | no |
| Template confirmation | Pop confirm dialog when replacing existing room | spec §4: "如果已有房间→弹出确认" | no (spec-mandated) |

## Findings (cited - path:lines)
- `src/main.ts:1-1381` — Main entry: all mode switching, wall drawing, door/window CRUD, furniture placement, layout, events, localStorage. 1381 lines, needs splitting into modules.
- `src/ui/toolbar.ts:1-150` — Current toolbar: mode buttons, undo/redo (walls only), grid toggle, create room, door direction switch.
- `src/ui/sidebar.ts:1-88` — Current sidebar: building catalog (door/window), furniture catalog, drag-to-place.
- `src/ui/statusBar.ts:1-13` — Current status bar: static text setter with dot indicator.
- `src/state/store.ts:1-145` — State: mode, walls, doors, windows, furniture, undo/redo (walls only), localStorage save/load.
- `src/engine/types.ts:1-92` — Types: EditorMode='draw'|'place'|'layout', Door, Window, FurnitureItem, WallSegment. Mode needs expansion for tab-based UI.
- `src/engine/layout.ts:1-120` — Single-route layout algorithm (wall-hugging strategy). Needs 3-variant extension.
- `src/engine/constants.ts:1-39` — Constants: grid, wall, furniture defs, door/window defaults. Canvas is 800×600px.
- `src/styles/main.css:1-278` — CSS: sidebar 200px, mode buttons, furniture cards, status bar, responsive.
- `src/renderer/furnitureLayer.ts:1-180` — Furniture rendering: creates Konva groups with drag (rot handle + delete x). No resize handles.
- `src/renderer/doorLayer.ts:1-364` — Door/window rendering: drag-snap-to-wall, selection handles, resize handles.
- `index.html:1-182` — Current HTML: title bar, AI input, template buttons, sidebar with mode/catalog/panels, canvas, status bar.
- Collision detection exists in engine but not wired to drag UX: `src/engine/layout.ts:10-16` (.collides, .collidesAny, .insideRoom).
- Ghost preview partially exists for door/window: `src/renderer/previewLayer.ts`.

## Decisions (with rationale)
| # | Decision | Rationale |
|---|----------|-----------|
| D0 | Keep Konva as rendering engine, keep all engine/ modules unchanged | spec §16: "engine/ 全部保留不变" |
| D1 | Replace mode-based UI with 4-tab header bar | spec §2: 4标签始终可点击 |
| D2 | Sidebar content switches per tab (not per mode) | spec §2: "内容随标签切换" |
| D3 | Create new `ui/` modules: step1Room.ts, step2Furniture.ts, step3Layout.ts, step4Adjust.ts, canvasControls.ts, ghostPreview.ts, contextMenu.ts | spec §16 lists these exact files |
| D4 | Split main.ts responsibilities into the new modules; main.ts becomes orchestration-only (~300 lines) | current 1381 lines is unmaintainable |
| D5 | Use HTML DOM (not Konva) for all panel UI, menus, and overlays | Konva is canvas-only; panels need form inputs, buttons, scrolling |
| D6 | 300ms ease-out for fit-to-canvas animation | spec §12: "铺满画布 300ms ease-out" |
| D7 | Cursor changes via stage.container().style.cursor | already partially done for door/window grab; extend per spec §3.4 table |
| D8 | Unified undo stack stored in state (not just wall points) | spec §14: "单个撤销栈，跨标签统一" |

## Scope IN
- 4-tab header bar: 🏠房间设置, 🪑选择家具, ✨布局方案, ✋微调
- Room setup panel: template cards, custom dimensions, manual draw button, door/window placement
- Furniture selection panel: quantity controls [+], "排一下" button, "清空选择"
- Layout plans panel: 3 scheme cards with ← → navigation, "重新排", "恢复默认"
- Micro-adjustment panel: furniture list with rotation/position, restore, add furniture
- Canvas overlay: [⊞ 铺满画布] button, [100%] zoom scale readout
- Pan with Space+drag and middle-mouse drag
- Context-sensitive status bar (12 messages per spec §14)
- Full cursor table (13 cursors per spec §3.4)
- Wall hover glow (淡蓝色发光)
- Wall length annotations
- Door/window inline labels (🚪80, 🪟150)
- Right-click furniture context menu
- 4px drag dead zone
- Selection state preserved across tabs
- Unified 50-step undo/redo
- E2E collision detection with auto-bounce
- Export dialog with 2x PNG
- Empty state: first-open template cards on canvas
- No-room tab protection with guidance text

## Scope OUT (Must NOT have)
- AI input box (spec §2: "删掉了 AI 输入框")
- "下一步" buttons (spec §1: "每个面板底部没有'下一步'")
- Tab numbering (spec §1: "标签上没有数字编号")
- Fake loading animations (spec §6: "不做假加载动画")
- Wall-mounted furniture (spec §9.2: "当前阶段不做壁挂标记")
- Multi-room support (single room only)
- User accounts, backend, database (local-only)
- Touch/gesture support beyond basic pointer events

## Open questions
1. ✅ Layout algorithm: A+B only, C deferred (user decision)
2. ✅ Existing furniture: clear localStorage, start fresh (user decision)
3. ✅ Template cards: CSS overlay on canvas area (user decision)

## Approval gate
status: awaiting-approval
next: write .omo/plans/v51-ui-overhaul.md after approval

