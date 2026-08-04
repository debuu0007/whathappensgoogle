# PLAN — "What Happens When You Hit Enter on google.com" in 3D

An interactive Three.js journey where **you are the packet**. The camera rides the request from the keyboard to Google's servers and back, stopping at 6 hops. Each hop is a stylized 3D diorama with hotspots that explain what's happening — in two depths: **Easy mode** (anyone can follow) and **Interview mode** (the real answer, sourced from [alex/what-happens-when](https://github.com/alex/what-happens-when)).

Formula we're recreating (from @thebuggeddev's 3D anatomy app):
**universally-known subject + only-ever-seen-flat + explorable 3D + process story + free link.**
His pipeline: GPT Image (scene design) → Tripo (image→3D) → coding agent (master prompt + design image + models, iterate). We adapt it below.

---

## 1. The Experience (storyboard)

Pattern per hop, stolen directly from the anatomy demo: **Show → Focus → Explain → Transition → Repeat.**

### Entry / Hero state
- A dark void with a glowing browser window floating center-screen, URL bar reading `google.com`, cursor blinking. Subtle auto-rotation + camera drift (never fully static).
- One line of copy: *"You hit Enter. 300 milliseconds later, a page appears. This is everything that happened in between."*
- A pulsing **[Press Enter]** prompt. Hitting Enter (or tapping) fires the packet — the camera detaches and becomes the packet. This is the hook moment; it must feel great.

### The 6 hops (scope-cut, final)

| # | Hop | Diorama concept | Hero moment |
|---|-----|-----------------|-------------|
| 1 | **The Browser** | Inside the browser: URL bar as a machine that parses text, a cache vault, an HSTS checklist | The URL string physically splits into scheme/host/path; cache vault opens and is empty → journey must begin |
| 2 | **DNS** | A "phonebook district": your resolver tower asks root → TLD → authoritative towers, each a distinct building | Query orb bounces between towers, returns carrying `142.250.x.x` stamped on it |
| 3 | **TCP Handshake** | Two platforms (client/server) across a chasm; a bridge builds itself in 3 moves | SYN → SYN-ACK → ACK as three glowing orbs; bridge segments lock in with each one |
| 4 | **TLS** | A tunnel forms around the bridge: certificate as a giant seal that gets verified, keys exchanged, tunnel walls crystallize | The packet gets visually "wrapped" in an encrypted shell — from here on it looks armored |
| 5 | **Google Edge (LB + CDN)** | A vast data-center vista: anycast beacons, a load balancer as a sorting hub routing packet streams to server racks | Camera pulls back to reveal scale — thousands of instanced packet streams flowing (the "whoa" screenshot people will share) |
| 6 | **Server → Response → Render** | App server assembles the response; then the return trip is a fast rewind blur; finale: the packet unpacks into HTML and the Google homepage *assembles itself in 3D* (logo, search box, buttons flying into place) | Page assembly = ending payoff; timer overlay shows "~250ms total" |

> The full pipeline had 7+ stops (DNS, TCP, TLS, LB, CDN, app server, DB). Scope cut: LB+CDN merge into hop 5, app server + DB + render merge into hop 6. A DB B-tree deep-dive is explicitly the **sequel app**, not scope creep here.

### Per-hop structure
1. **Arrive** — camera decelerates into the diorama on its rail, scene lights up, previous scene dims behind.
2. **Overview beat** — 2-second auto-framed establishing shot; hop title fades in.
3. **Explore** — 3–5 hotspots glow. Click/tap one → camera eases into a focus orbit, hotspot's meshes highlight, everything else dims, info card slides in.
4. **Depart** — "Continue →" (or scroll) sends the packet to the next hop through a travel transition (streaking light tunnel, ~1.5s, doubles as an asset-loading window).

---

## 2. Two-Mode Content System (Easy vs. Interview)

One scene graph, two text tiers — mode is a global toggle, switchable at any time, persisted in `localStorage`.

- **Easy mode** — analogy-first, zero jargon, ~2 sentences per hotspot. ("DNS is the internet's phonebook: you know the name, it finds the number.")
- **Interview mode** — the actual answer you'd give in a system-design/HLD interview, with correct terminology, sourced/condensed from `what-happens-when` (attribute it in the footer). Interview mode also **unlocks extra hotspots** that Easy mode hides entirely:
  - Hop 1: HSTS preload list, socket syscall, browser cache hierarchy (memory → disk → OS)
  - Hop 2: recursive vs. iterative queries, TTLs & caching layers, `/etc/hosts`, ARP to the gateway
  - Hop 3: ports & sockets, sequence numbers, why three ways (not two)
  - Hop 4: cipher negotiation, certificate chain of trust, session keys, TLS 1.3 1-RTT
  - Hop 5: anycast, TCP termination at the edge, HTTP/2 vs HTTP/3 (QUIC)
  - Hop 6: request parsing, cache lookup vs. DB hit, then parse → DOM → CSSOM → render tree → layout → paint → composite

**Content lives in data, not code** — `src/content/hops.json`:

```json
{
  "id": "dns",
  "title": { "easy": "Finding the address", "real": "DNS resolution" },
  "cameraRail": { "in": [..], "overview": {..} },
  "hotspots": [
    {
      "id": "resolver",
      "anchorMesh": "ResolverTower",
      "focus": { "pos": [..], "lookAt": [..] },
      "modes": ["easy", "real"],
      "easy": { "title": "...", "body": "..." },
      "real": { "title": "...", "body": "...", "interviewLine": "One quotable sentence for the interview." }
    }
  ]
}
```

`interviewLine` matters: in Interview mode every card ends with a highlighted one-liner — *"if you say only one thing about this hop, say this."* That's the screenshot/shareable unit, and it directly serves the HLD-prep origin story.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** | instant dev server, easy code-splitting, static output for free hosting |
| 3D | **Three.js (vanilla, no React)** | full control over the render loop; R3F adds bundle + abstraction we don't need for a single-canvas story app |
| Animation | **GSAP** (core + ScrollTrigger if we add scroll-scrub) | timeline choreography, best-in-class easing, `overwrite: 'auto'` handles interrupted transitions safely |
| Camera path | `THREE.CatmullRomCurve3` rail + custom controller | the packet-as-camera spine |
| Post | `postprocessing` (pmndrs) | selective bloom for glow, cheaper & better-maintained than three's examples EffectComposer |
| UI | Plain HTML/CSS overlay (no framework) | info cards, progress rail, mode toggle; DOM text stays crisp, accessible, selectable |
| Asset tools | Blender + **gltf-transform CLI** + gltfpack | the entire optimization pipeline (§6) |
| Dev tools | lil-gui, three stats panel | camera-pose authoring, perf monitoring — dev-only, tree-shaken from prod |

Hosting: any static host (Vercel/Netlify/GitHub Pages). No backend at all.

---

## 4. Architecture

```
src/
  main.js               // boot: renderer, loop, loaders
  core/
    state.js            // the state machine (below) — single source of truth
    events.js           // tiny pub/sub; UI and 3D both subscribe to state
    loop.js             // rAF loop, delta clamp, pause on tab-hidden
  camera/
    rail.js             // CatmullRom path per hop + travel segments
    controller.js       // TRAVELING / OVERVIEW / FOCUSED behaviors, damping
  scenes/
    sceneManager.js     // load/unload/dim hops, preloading
    hops/dns.js ...     // per-hop setup: models, idle anims, particles
  fx/
    highlight.js        // emissive boost, dimming, selective bloom
    packets.js          // instanced packet/orb streams
  content/
    hops.json           // ALL text + hotspot + camera-pose data
  ui/
    cards.js, progress.js, modeToggle.js, loadingScreen.js
```

### State machine (small but strict — this is what keeps it fluent)

```js
state = {
  phase: 'LOADING' | 'HERO' | 'TRAVELING' | 'OVERVIEW' | 'FOCUSED' | 'FINALE',
  hopIndex: 0..5,
  focusedHotspot: string | null,
  mode: 'easy' | 'real',
  transitionLock: boolean   // input ignored while a camera transition runs
}
```

Rules that prevent the app ever feeling broken:
- All transitions go through the machine; UI and camera **react to state**, they never drive each other directly.
- `transitionLock` blocks new inputs mid-transition, **but** a click on another hotspot while FOCUSED is allowed — GSAP `overwrite: 'auto'` retargets the tween from the camera's *current* position, so it never snaps.
- Every state is deep-linkable: `#/dns/resolver?mode=real` → sharable URLs for individual explanations (huge for distribution: people can link "the TLS part").

---

## 5. Motion & Fluency Techniques (the "feel" checklist)

This is what made the anatomy demo read as premium. Every item below is a concrete technique:

1. **Camera = two independently-smoothed targets.** Position and lookAt are separate. Both chase their goals with **frame-rate-independent damping**: `THREE.MathUtils.damp(current, goal, lambda, delta)` — *never* `lerp(a, b, 0.1)` per frame (that's fps-dependent and stutters on 120Hz/low-end alike).
2. **Rail travel with eased scrub.** During TRAVELING, a GSAP tween animates a single scalar `t` (0→1) with `power2.inOut`; camera position = `curve.getPointAt(t)`, lookAt = a point *ahead* on the curve (`t + 0.05`) so the camera banks into turns like a camera dolly — this alone makes "being the packet" feel real.
3. **Focus transitions**: GSAP timeline animates camera pose + FOV together (slight FOV tighten 50→42 on focus = cinematic push-in). Duration 1.1–1.4s, `power3.inOut`. Never under 0.8s (jarring), never over 2s (sluggish).
4. **Limited OrbitControls only while FOCUSED** — clamped polar/azimuth (±30°), zoom range locked, `enableDamping: true`. User gets agency without being able to get lost. On blur/depart, controls are disabled and the rail takes over.
5. **Nothing is ever static**: hero model idle-rotates at ~0.05 rad/s; camera has a perpetual micro-drift (two slow sine offsets, ±0.05 units); highlighted hotspots "breathe" (emissive intensity on a sine, period ~2s); packet orbs bob. Cheap, huge perceived quality.
6. **Highlights fade, never pop**: emissive intensity and dim-opacity are tweened (0.4s). Dimming = drop non-focused materials to ~25% opacity + desaturate (small shader tweak or pre-made grey material swap).
7. **Selective bloom** on an emissive layer (postprocessing's `SelectiveBloomEffect` or layer-based) so glowing things glow without washing the whole frame.
8. **Text choreography**: cards slide+fade in 300ms *after* the camera settles (chain it on the timeline), not simultaneously — the eye follows motion first, then reads.
9. **Delta clamping** in the loop (`Math.min(delta, 1/30)`) so a background-tab return doesn't teleport animations.
10. **Interruption-safe everything**: any user input mid-animation retargets rather than queues or snaps (GSAP overwrite mode is the mechanism).

---

## 6. Asset Pipeline & Optimization (the 900MB→28MB section)

### Creation (adapting his pipeline)
1. **Style bible first**: one GPT-Image master prompt defining the look — *stylized low-poly-ish tech diorama, dark background, emissive cyan/amber accents, soft rim light* — then per-hop scene concepts generated with it. Consistency across hops is what makes it feel like one product.
2. **Tripo (image→3D)** for hero set-pieces only: towers, server racks, the browser window, the LB hub. ~8–12 models total.
3. **Everything else is geometry in code**: packets/orbs (instanced spheres/icosahedrons), cables (TubeGeometry along curves), beams, particles, the bridge segments, page-assembly pieces. Code geometry is ~0 bytes of asset and always crisp.
4. **Blender pass on every Tripo export** (Tripo output is always dirty): delete hidden/internal geometry, merge by distance, decimate to target (hero prop ≤ 25k tris, background prop ≤ 8k), fix normals, rename meshes to match `hops.json` anchors, join materials.
5. Coding-agent iteration loop like his: master prompt + design image + optimized models → build scene → screenshot → refine.

### Compression (where 900MB becomes 28MB — run on every model, scripted)
One `npm run assets` script so it's repeatable, not artisanal:

```bash
# per model: dedupe → weld → simplify → resize/compress textures → meshopt-compress
gltf-transform dedup in.glb tmp.glb
gltf-transform weld tmp.glb tmp.glb
gltf-transform simplify tmp.glb tmp.glb --ratio 0.75 --error 0.001
gltf-transform resize tmp.glb tmp.glb --width 1024 --height 1024
gltf-transform etc1s tmp.glb tmp.glb          # KTX2/Basis texture compression
gltfpack -i tmp.glb -o out.glb -cc            # meshopt geometry compression
```

Why each matters:
- **Meshopt (gltfpack `-cc`)** — typically 5–10× smaller geometry, and decodes *faster* than Draco with a tiny WASM decoder. Prefer over Draco.
- **KTX2/Basis (etc1s)** — the big one Tripo victims miss: PNG textures decompress to full size **in GPU memory**; KTX2 stays compressed on the GPU. 4K Tripo textures → 1K KTX2 is routinely 20–40× smaller with zero visible loss at our art style. Use `uastc` only for normal maps if we keep any.
- **Simplify + weld** — Tripo meshes are massively over-tessellated for a stylized look.
- **Drop PBR maps we don't need**: our look is emissive + flat-ish shading; kill metalness/roughness/AO maps entirely where possible → sometimes the majority of file size.

### Loading strategy
- **Per-hop lazy loading**: boot loads *only* hero scene (
  budget: ≤ 2.5MB before first interaction). While the user reads hop N, `sceneManager` silently fetches hop N+1; the 1.5s travel transition covers any remainder. A hop is never entered until loaded — the transition simply holds a beat longer on slow networks (with the packet "charging up" so waiting reads as intentional).
- One `GLTFLoader` with `MeshoptDecoder` + `KTX2Loader` (self-hosted decoders); `LoadingManager` drives a real progress bar on the hero screen.
- Serve with Brotli (default on Vercel/Netlify). Cache-bust via content hashes.

### Runtime performance techniques
- **InstancedMesh** for all repeated things — the hop-5 "thousands of packet streams" money shot is one draw call per orb type with per-instance color/offset animated in a small shader or via `instanceMatrix` updates.
- **Only the active hop (+ dimmed neighbor) is `visible`**; others are fully skipped by the renderer. Dispose geometries/textures of hops ≥ 2 behind (`.dispose()`) on mobile.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`; on detected low-end (fps probe over first 2s), drop to 1.5 and disable bloom.
- Lights: one ambient + one key directional + per-hop emissives. **No shadow maps** — fake contact shadows with a baked blob texture. Shadows are the classic silent frame-killer.
- Reuse materials aggressively (shared material library, per-hop color via `material.clone()` only when needed).
- Pause the rAF loop on `visibilitychange`.

### Budgets (hard numbers, checked in CI-ish spirit)
| Metric | Target |
|---|---|
| Total transfer, full journey | **≤ 25MB** |
| First interactive (hero) | ≤ 2.5MB, < 3s on 4G |
| Per-hop assets | ≤ 4MB |
| Frame rate | 60fps desktop, ≥ 30fps on a 2022 mid-range phone |
| Draw calls per frame | < 150 |

**Document the before/after at every step** — the asset-size struggle is launch content, not friction (his 900MB→28MB post was a highlight). Keep a `notes/asset-log.md` with real numbers per model.

---

## 7. UI Layer

- **Progress rail** (bottom or left): 6 nodes + connecting line, current hop lit, packet icon travels along it in sync with the camera. Clicking a node jumps (with full transition) — also the mobile navigation.
- **Info cards**: DOM overlay anchored by projecting the hotspot's 3D anchor to screen space each frame (`vector.project(camera)`), clamped to viewport, with a thin leader line (SVG) to the object. DOM = crisp text, copy-paste-able, screen-reader-visible.
- **Mode toggle** top-right: `Easy ⇄ Interview`, animated, always available; switching while FOCUSED just swaps card text + shows/hides real-only hotspots with a fade.
- **Mobile**: tap = focus, drag = orbit (when FOCUSED), swipe/buttons for hop navigation; cards become bottom sheets; hold 30fps by disabling bloom + pixelRatio 1.5.
- **Keyboard**: Enter to begin (thematically mandatory), ←/→ hops, Esc unfocus, Tab through hotspots (accessibility baseline).
- Footer: link to `what-happens-when` (attribution), GitHub repo link (free-code part of the formula), share button with prefilled post text.

---

## 8. Milestones

**M0 — Skeleton (1–2 days).** Vite + Three boot, render loop, state machine, camera rail with placeholder boxes for all 6 hops, hop-to-hop travel working end-to-end with dummy content. *The whole journey clickable with cubes before any real asset exists.*

**M1 — Vertical slice: the DNS hop (2–3 days).** One hop at final quality: Tripo models through the full optimization pipeline, highlight system, hotspots, cards, both content modes, bloom, idle motion. **This is the go/no-go checkpoint** — if the slice feels great, the formula works; everything after is repetition.

**M2 — All hops (4–6 days).** Remaining 5 dioramas via the now-proven pipeline (this is where creation parallelizes: generate all scene images in one batch, all Tripo jobs in one batch). Hero intro + finale page-assembly sequence. All Interview-mode content written and fact-checked against `what-happens-when`.

**M3 — Polish & perf (2–3 days).** Mobile pass, low-end fallbacks, budgets enforced, deep links, loading/error states, micro-animation pass, copy edit. External playtest with 3–5 people; watch where they get bored (cut or shorten that beat).

**M4 — Launch (1 day, planned as its own day, not a cold drop).**
- Ship URL + public GitHub repo (code free = formula step 5).
- Thread: hook (result GIF of hop 5 or the page-assembly finale) → process story (pipeline, Tripo, and *the asset-size numbers*) → link. Post the interview-prep angle separately ("study for the classic question by flying through it").
- Deep-link individual hops as follow-up posts across the week (the sharable-URL feature is built for exactly this).

Total: roughly 2–2.5 weeks of focused work.

---

## 9. Risks & Scope Guards

| Risk | Guard |
|---|---|
| Tripo models look inconsistent across hops | Style bible + single master image prompt; M1 slice validates before batch-generating |
| Scope creep into hop 7, 8, 9… | Hard cap at 6. DB internals & load-balancing deep-dives are the announced **sequel series** (same engine: B-tree traversal in 3D; distributed system under load) |
| Interview mode becomes a wall of text | Hotspot body ≤ 80 words + one `interviewLine`; depth comes from *more hotspots*, not longer text |
| Perf death by post-processing | Bloom is the only post effect, period. No SSAO, no DOF |
| "Real" content inaccuracies get dunked on | Every Interview-mode claim traced to `what-happens-when` or MDN; note where reality is simplified (e.g., "modern Chrome actually speculatively preconnects") — nerds respect acknowledged simplification, not silent error |
| Weeks lost hand-tuning camera poses | lil-gui dev panel with "copy current camera pose as JSON" button from day 1 (M0) |

---

## 10. Definition of Done

- A first-time visitor on a phone finishes all 6 hops in under 5 minutes and can say what DNS and the TCP handshake are.
- A CS student in Interview mode can genuinely rehearse the interview answer, hop by hop, and share a deep link to any single explanation.
- Total payload ≤ 25MB, hero loads < 3s on 4G, no transition ever snaps or stutters.
- The repo is public, the asset-log has real before/after numbers, and launch-day content is drafted *before* launch day.
