# REVIEW — v1 playtest findings & improvement plan

Verdict from playtest: the shell is right (hero, color theory, motion smoothness, state machine all work), but the two things that make the app worth sharing are broken: **the content teaches too little** and **the focus experience shows too little**. Both are fixable without touching the architecture — the state machine, camera damping, UI plumbing, and deep links all survive as-is.

---

## Finding 1 — Content is too shallow in both modes (root cause: the card format, not the writing)

### Evidence
- `src/content/hops.json` is **74 lines for the entire knowledge layer** — 24 hotspots, each with a single ≤80-word body. The source material (alex/what-happens-when) covers this journey in thousands of words of genuinely interesting detail; we kept almost none of it.
- The original GOAL.md rule *"card bodies ≤80 words; depth = more hotspots, never longer text"* backfired: hotspot count stayed low (only **one** real-only hotspot per hop), so the cap just amputated depth. An Interview-mode reader learns roughly the same 4 facts an Easy reader does, phrased more formally.
- Real-mode bodies state *what* happens but almost never *why* or *with what numbers* — e.g. the TCP hotspots never mention ports, ISN randomization, SYN queues, slow start, or why two messages aren't enough (the one place it appears, it's compressed into a subordinate clause in `socket-state`).

### Fix: restructure the card schema, then rewrite the content into it

**1a. New card schema (`hops.json` v2)** — cards become layered documents, not captions:

```json
"real": {
  "title": "TCP three-way handshake",
  "summary": "1–2 sentence orientation (what the reader is looking at).",
  "sections": [
    { "heading": "What actually happens", "body": "..." },
    { "heading": "Why it works this way", "body": "..." },
    { "heading": "The numbers", "body": "ports, sizes, RTTs, TTLs..." }
  ],
  "deeper": ["collapsible 'Go deeper' bullets — the what-happens-when-grade details"],
  "terms": { "ISN": "Initial Sequence Number — the random starting counter..." },
  "interviewLine": "unchanged — the one quotable sentence"
}
```
- Cards get a scrollable body with sections; `deeper` renders as a collapsed accordion; every key in `terms` renders as a dotted-underline tooltip word wherever it appears in that card. **Delete the 80-word cap; new rule: summary ≤2 sentences, each section ≤120 words, unlimited `deeper` bullets.**
- `populateCard` in `src/ui/ui.js:89` currently sets one `textContent` — needs to render this structure (semantic HTML, still copy-paste friendly).

**1b. Rebalance the modes** (the playtest's exact request):
- **Easy mode (relabel UI as "Guided")** = merge of current-easy + current-real: keeps the analogies as openers, then actually explains the mechanism, defining every term inline on first use ("DNS — the system that turns names into IP addresses"). Assume the reader has *never heard* of DNS or TLS. Target: current Interview-mode informativeness, but self-contained.
- **Interview mode** = a genuine level up, condensed from what-happens-when + MDN. Also raise real-only hotspots from 1 to **2–3 per hop**.
- Keep mode ids `easy`/`real` internally (deep links unchanged); only display labels change.

**1c. Minimum content spec per hop for Interview mode** (what must appear, all sourced from what-happens-when / MDN):
- **browser** — omnibox URL-vs-search heuristic; IDNA/Punycode; cache hierarchy (memory→disk→OS, revalidation vs reuse); HSTS preload mechanics + SSL-strip threat; socket syscall & what the kernel takes over (segmentation, checksums); *fun opener: keyboard interrupt → OS → focused window, as one "before the browser even sees it" deeper-bullet*.
- **dns** — stub vs recursive vs iterative; per-layer caches with typical TTLs; hosts file; UDP 53, response-size → EDNS0/TCP fallback; ARP to the gateway; DoH/DoT note; how google.com uses low TTLs + anycast at the resolution layer.
- **tcp** — ports & ephemeral port selection; ISN randomization and why (off-path injection); why 3 messages (bidirectional reachability + two independent sequence spaces); SYN/accept queues & SYN-cookie note; MSS/MTU; slow start & congestion window; NAT rewriting on egress.
- **tls** — full ClientHello contents (SNI, ALPN, supported versions, key shares); certificate chain → local root store, hostname & validity checks, OCSP stapling; HKDF key derivation & forward secrecy; TLS 1.3 1-RTT vs 1.2's 2-RTT; session resumption & 0-RTT replay caveat.
- **edge** — BGP anycast (routing-topology "nearest"); GFE role: TCP/TLS termination, DDoS absorption, health-checked backends; consistent hashing (Maglev-style) for connection affinity; HTTP/2 stream multiplexing vs HTTP/3-QUIC and head-of-line blocking — why QUIC exists.
- **server** — request anatomy (method/path/headers/cookies); routing, auth, and the cache-first pipeline; for Google specifically: index shard fan-out and answer assembly under a ~200ms budget; response headers & Brotli; then the render pipeline with real ordering: preload scanner, parser-blocking scripts, DOM/CSSOM, render tree, layout, paint, composite, and when first paint can happen.

Every claim traceable; where simplified, the card says so (this rule stays).

---

## Finding 2 — Focus view shows blank black space; dioramas visible only for a split second

### Root causes (three compounding, all confirmed in code)

**2a. Focus camera poses are hand-authored world coordinates that don't know where the meshes are.**
`hops.json` stores absolute `focus.pos/lookAt` per hotspot, while actual mesh positions live independently in `src/assets/procedural.js` (group-local, offset by `hop.center`, **plus** a per-frame idle sway `group.rotation.y = sin(...)` in `src/scenes/sceneManager.js:75` that the static JSON can never account for). Any drift between the two files points the camera at empty void — and the JSON was written blind. This is the direct cause of "looking at blank black space."

**2b. The dim system erases the world.**
`setFocus` (`src/scenes/sceneManager.js:45-55`) drops every non-selected mesh to **0.22 opacity** — including the platform and all environment — against a near-black background (`0x05070b`) with exponential fog. Dim ~everything to 22% on near-black = the scene effectively ceases to exist; only a small anchor mesh (some are 0.28-radius orbs) floats in blackness, and the tightened 42° FOV frames mostly void around it. This is why the custom assets are "visible for only a split second": they exist at overview, then vanish the moment you click.
Also: `node.material.depthWrite = selected` toggles cause visible popping, and the "selected" test (`node === anchor || anchor.children.includes(node) || node.parent === anchor`) only matches **direct** children — any deeper nesting (and every future GLB swap, which always nests deeper) will dim parts of the focused object itself.

**2c. Nothing happens at a hotspot.**
Each hop has one looping ambient `userData.update`, but focusing a hotspot changes nothing in the 3D scene — no choreography answers the click. Combined with 2b, "land on topic" = world goes dark + a card of text. The 3D layer stops earning its place exactly at the teaching moment.

### Fixes

**F1. Auto-framing — delete hand-authored focus poses.**
On FOCUS, compute the anchor's world bounding sphere (`Box3.setFromObject` → sphere) and derive the camera pose: `distance = radius / tan(fov/2) × 1.35` (fill ~60–70% of frame), clamped to a minimum distance so tiny orbs don't produce macro shots of nothing; direction defaults to "from the current camera, biased toward the overview side" with an optional per-hotspot `viewDir` hint in JSON; `lookAt` = sphere center **recomputed after the idle sway is applied** (or simpler: freeze the sway while FOCUSED, tweening `group.rotation.y` to 0). `focus.pos/lookAt` in hops.json become optional overrides only. This makes mis-framing structurally impossible, including after future GLB swaps.

**F2. Rework dimming from "erase" to "recede."**
- Dim floor 0.45 (not 0.22); platform + environment meshes tagged `userData.environment = true` never drop below 0.65.
- De-emphasize primarily via **emissive reduction + slight desaturation**, not opacity — silhouettes must stay readable so the diorama never disappears.
- Add emphasis instead of only removing it: a soft spotlight (or boosted rim/emissive) on the focused anchor + slightly stronger bloom contribution — focus should look like a stage light coming ON, not the house lights going off.
- Fix the descendant test with a parent-chain walk (`while (n) { if (n === anchor) …; n = n.parent }`); stop toggling `depthWrite` (tween opacity only).

**F3. Focus stories — every hotspot answers its click with choreography.**
Add `spot.story` (string id) and per-hop `group.userData.playStory(id)` / `stopStory()`. On FOCUS: ambient loop pauses (or dims), and a 3–6s **looping** sequence specific to that hotspot plays, synchronized to what the card teaches. Concretely, minimum set:
- `dns/resolver`: query orb replays only client→resolver leg, with a cache-check flash before it departs
- `dns/root|tld|authoritative`: orb replays only that referral leg; receiving tower's beacon flares; answer ring stamps on the final leg
- `tcp/syn|synack|ack`: ONLY that orb crosses, leaving a trail; its bridge segment locks in with a satisfying snap on arrival; the other two beams stay ghosted
- `tls/certificate`: chain of three seals appears (leaf→intermediate→root), each verifying with a check flourish
- `tls/keys`: the two octahedra orbit, exchange particle streams, and merge into one shared key glyph
- `edge/balancer`: a burst of stream packets visibly routes through the hub to different racks, one rack flashing "unhealthy" and being routed around
- `server/render`: the render-tree nodes assemble stepwise — DOM row, then style pass recolors them, then layout snaps them into a grid, then paint fills
Remaining hotspots minimally get a targeted amplification of their existing ambient motion. This is the "no good animation when I land" fix — the pattern is data-driven, so GLB swaps keep working.

**F4. Keep the world visible between and around focus moments.**
- During TRAVELING, bend the rail so the camera *looks at* the upcoming diorama on approach instead of flying through starfield void; keep the destination hop fully lit during travel.
- Add a persistent luminous **route line** connecting all six hop platforms (a packet-trail spine through the world) so wide shots and travel always have structure — cheap TubeGeometry, big payoff against "blank black space" at every altitude.
- After SETTLED at overview, stagger the hotspot buttons in (60ms apart, fade+rise) instead of popping all at once; always render a small dot at each hotspot's true projected anchor point, and drop the artificial vertical `spread` in `updateAnchors` (`src/ui/ui.js:105-108`) in favor of simple overlap resolution — labels currently detach from their objects, which reads as more disorientation.

---

## Finding 3 — smaller issues worth fixing in the same pass
1. `playTimer` (`src/ui/ui.js:71`, 116) is re-invoked on every FINALE-phase state change (FINISH then SETTLED both call it) → two concurrent rAF loops write the same node. Guard with an `active` flag.
2. `upgradeToGlb` (`src/scenes/sceneManager.js:25`) resets `targetOpacity = 1` on all replacement meshes — swapping while a hop is dimmed/focused would flash to full brightness. Re-apply current focus state after swap.
3. `SET_MODE` while FOCUSED on a shared hotspot swaps card text instantly with no transition — add a 150ms crossfade on the card body when mode changes.
4. Establishing-shot hold is a fixed `gsap.delayedCall(2, …)` (`src/camera/controller.js:43`) even when arriving via a deep link or a repeat visit — make it 2s on first arrival per hop, ~0.8s after.
5. `hops.json` mixes UI copy, camera poses, and knowledge content in one file — with content v2 growing ~5×, split into `content/` (per-hop knowledge JSON) and `scene/` (poses/anchors), so content editing can't break framing.

---

## What NOT to change
Hero screen and its copy; the palette/style bible; the state machine and event flow; damped-camera feel (`controller.update`); progress rail; deep-link scheme; instanced edge streams; performance budgets and the bloom-only post rule. All confirmed good in playtest.

---

# GOAL for Codex (paste from here down)

Read `REVIEW.md` at the repo root — it contains playtest findings with file/line evidence and the agreed fixes. Implement all of it. Summary of the contract:

**1. Content overhaul (REVIEW Finding 1) — the biggest work item.**
- Migrate `src/content/hops.json` to the v2 layered card schema (summary / sections / deeper accordion / terms tooltips / interviewLine) and split knowledge content from scene data (poses/anchors) into separate files.
- Rewrite ALL content per the rebalance: Easy mode (UI label "Guided") = analogy opener + real mechanism with every term defined inline, assuming the reader has never heard of DNS or TLS; Interview mode = substantially deeper, meeting the minimum per-hop content spec in REVIEW.md §1c, with 2–3 real-only hotspots per hop. The old 80-word cap is repealed: summary ≤2 sentences, sections ≤120 words each, unlimited deeper-bullets. Every Interview claim traceable to what-happens-when or MDN; acknowledged simplifications stay.
- Update `populateCard` to render the layered schema (scrollable card, accordion, term tooltips, crossfade on mode switch). Keep internal mode ids `easy`/`real` so deep links don't break.

**2. Focus experience overhaul (REVIEW Finding 2).**
- F1: replace hand-authored focus poses with runtime auto-framing from the anchor's world bounding sphere (fill 60–70% of frame, min-distance clamp, optional `viewDir` hint, sway frozen while FOCUSED). JSON poses become optional overrides.
- F2: dim rework — floor 0.45, environment meshes ≥0.65, de-emphasis via emissive/desaturation rather than opacity, spotlight/rim emphasis ON the focused anchor, parent-chain descendant test, no depthWrite toggling.
- F3: focus stories — `spot.story` + per-hop `playStory/stopStory`; implement at minimum the sequences listed in REVIEW.md F3, looping, synchronized with the card's teaching.
- F4: travel looks at the destination diorama on approach; persistent route line connecting all six platforms; staggered hotspot-button entrance; true anchor dots; remove the artificial label spread in `updateAnchors`.

**3. Fix the four smaller issues in REVIEW.md Finding 3 (timer double-loop, GLB swap dim state, mode-switch crossfade, establishing-hold duration).**

**Guards:** do not change anything in "What NOT to change." Keep all original GOAL.md constraints except the repealed 80-word cap: vanilla Three.js + GSAP, bloom-only post, no shadow maps, budgets (≤25MB, 60fps desktop / ≥30fps mobile), state machine as single source of truth, content in data files never in scene code. Keep `npm run dev` and `npm run build` green after every change; commit per work item (content schema → content rewrite → auto-framing → dim rework → focus stories → travel/UI polish → small fixes). Definition of done: on every one of the ~30 hotspots, clicking it frames the object correctly (nothing off-screen, no void shots), plays its story, and shows a card that teaches something the what-happens-when repo would nod at — verified by clicking through all hotspots in both modes.
