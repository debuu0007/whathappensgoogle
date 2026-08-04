# GOAL

Build a complete, deployable Three.js web app: **"What happens when you hit Enter on google.com" as an explorable 3D packet journey.** The camera IS the packet. Full specs live in `PLAN.md` (build plan) and `CONTEXT.md` (decisions + constraints) in this repo — read both first and follow them; this goal is the summary contract.

## What "done" looks like
A static Vite site where:
1. **Hero screen**: a glowing browser window in a dark void, URL bar reading `google.com`, blinking cursor, subtle idle drift. Pressing Enter (or tapping) fires the packet — the camera detaches and the journey begins.
2. The camera rides a smooth spline rail through **exactly 6 hop dioramas** (IDs: `browser`, `dns`, `tcp`, `tls`, `edge`, `server`):
   - **browser** — URL parsing, cache check, HSTS
   - **dns** — resolver → root → TLD → authoritative towers; query orb returns with an IP
   - **tcp** — 3-way handshake as a bridge building itself in 3 moves (SYN / SYN-ACK / ACK orbs)
   - **tls** — encrypted tunnel forms; certificate verified; packet becomes visually "armored" from here on
   - **edge** — load balancer + CDN data-center vista; thousands of instanced packet streams (the wow shot)
   - **server** — response assembled, fast return-trip blur, finale: the Google homepage assembles itself in 3D piece by piece, with a "~250ms total" timer overlay
3. Each hop: arrive → 2s establishing shot with title → 3–5 clickable glowing **hotspots** → click eases camera into a focus orbit (limited OrbitControls, ±30°), highlights that mesh, dims everything else, slides in an info card → "Continue" travels to the next hop (~1.5s light-tunnel transition that doubles as a loading window).
4. **Two content modes**, toggleable anytime, persisted in localStorage:
   - `easy` — analogy-first, ≤2 sentences per card, zero jargon
   - `real` (Interview mode) — correct terminology condensed from https://github.com/alex/what-happens-when (attribute in footer), PLUS extra hotspots that only exist in real mode, PLUS a highlighted one-line `interviewLine` at the end of every card. Card bodies ≤80 words; depth = more hotspots, never longer text.
5. **Deep links**: `#/dns/resolver?mode=real` restores that exact state.
6. UI: bottom progress rail (6 nodes, packet icon moves in sync, clickable to jump), mode toggle top-right, DOM-overlay info cards with leader lines, keyboard nav (Enter to start, ←/→ hops, Esc unfocus, Tab through hotspots), mobile support (tap/drag/swipe, cards as bottom sheets).

## Hard technical constraints (from PLAN.md — do not deviate)
- **Stack**: Vite + vanilla Three.js (NO React/R3F) + GSAP + `postprocessing` (pmndrs). Plain HTML/CSS for all UI text.
- **State machine is the single source of truth** (`LOADING | HERO | TRAVELING | OVERVIEW | FOCUSED | FINALE` + hopIndex + focusedHotspot + mode). UI and camera react to state; they never drive each other. `transitionLock` blocks input mid-transition, EXCEPT clicking another hotspot while FOCUSED retargets via GSAP `overwrite: 'auto'` — nothing ever snaps.
- **All content in `src/content/hops.json`** (text, hotspot anchors, camera poses per PLAN.md §2 schema) — zero copy in scene code.
- **Motion rules** (PLAN.md §5, all of them): frame-rate-independent damping via `THREE.MathUtils.damp` (never per-frame constant lerp); camera position and lookAt smoothed independently; on the rail, lookAt targets a point ahead on the curve so the camera banks into turns; focus transitions 1.1–1.4s `power3.inOut` with FOV push-in 50→42; nothing is ever fully static (idle drift, breathing emissives); cards animate in 300ms AFTER the camera settles; delta clamped to 1/30; rAF paused on `visibilitychange`.
- **Performance** (PLAN.md §6): bloom is the ONLY post effect; NO shadow maps (baked blob shadows); InstancedMesh for all repeated objects; only active hop + dimmed neighbor visible; per-hop lazy loading with preload-next-during-read; `pixelRatio = min(dpr, 2)` with a low-end fallback (fps probe → 1.5 + bloom off). Budgets: ≤25MB total, hero interactive ≤2.5MB, ≤4MB/hop, 60fps desktop, ≥30fps mid-range phone, <150 draw calls.

## Assets — build code-first
External model generation (GPT Image / Tripo) happens OUTSIDE this goal. Build every diorama from **procedural/code geometry now** (primitives, TubeGeometry cables, instanced orbs, emissive materials — a deliberate stylized low-poly look with dark background and cyan/amber emissive accents), structured so any mesh can later be swapped for an optimized GLB by name without touching logic: one `assets/manifest.js` mapping mesh IDs → `{ procedural: fn, glb?: url }`, loaded through a single GLTFLoader wired with MeshoptDecoder + KTX2Loader. Include the `npm run assets` gltf-transform/gltfpack script from PLAN.md §6 ready for when real models arrive. The app must look shippable with procedural geometry alone.

## Order of work (checkpoints — commit at each)
1. **M0**: boot + state machine + full 6-hop rail with placeholder geometry; entire journey navigable end-to-end.
2. **M1**: the `dns` hop at final quality (visuals, highlights, hotspots, both modes, bloom, idle motion) — this hop sets the quality bar and reusable patterns for the rest.
3. **M2**: remaining 5 hops + hero intro + finale page-assembly; all real-mode content written and fact-checked against what-happens-when.
4. **M3**: mobile + low-end fallbacks + deep links + loading/progress states + polish pass; verify budgets and fix any transition that snaps or stutters.

Also from day 1: a lil-gui dev panel (dev-only, tree-shaken from prod) with a "copy current camera pose as JSON" button for authoring poses.

## Guards
- Exactly 6 hops. No hop 7. No quiz, no accounts, no backend.
- Every Interview-mode claim must be traceable to what-happens-when or MDN; where simplified, say so in the card (e.g. "modern browsers actually preconnect speculatively").
- Verify continuously: keep `npm run dev` working after every change; the app must never be left in a broken state at a checkpoint commit.
- Log asset/bundle sizes at each milestone into `notes/asset-log.md`.
