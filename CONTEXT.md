# CONTEXT — whathappensgoogle

Living reference for this project. PLAN.md is the *what/how*; this file is the *why/decisions/sources* so any future session (or agent) can pick up without re-deriving.

## One-line pitch
"What happens when you hit enter on google.com" — the classic interview question as an explorable 3D packet journey. You are the packet; 6 hops; hotspots with the interview answer.

## Origin & inspiration
- Inspired by @thebuggeddev's 3D human-anatomy web app (~1M views, Aug 2026), part of his ongoing HLD-prep content arc.
- **His formula:** universally-known subject + only-ever-seen-flat + explorable 3D + process story + free link/code.
- **His pipeline:** GPT Image (scene design) → Tripo (image→3D) → coding agent with master prompt + design image + models, iterate.
- **His content insight:** the asset-size optimization struggle (900MB→28MB) was a post highlight — our struggle log is launch content, not friction. Keep `notes/asset-log.md` from day 1.
- Demo-video motion analysis (what made it feel premium) is captured in PLAN.md §5; the core loop is *Show → Focus → Explain → Transition → Repeat*.

## Canonical content source
- https://github.com/alex/what-happens-when — the definitive deep answer. Interview-mode text is condensed from it (+ MDN where newer, e.g. TLS 1.3, HTTP/3). **Attribute in the app footer.**
- Its full depth (keyboard scan codes, ARP, interrupt handlers…) is too much for a general audience → hence the two-mode design.

## Key decisions (with reasons)
1. **6 hops, hard cap**: Browser → DNS → TCP → TLS → Google Edge (LB+CDN merged) → Server/Response/Render (server+DB+render merged). Cut from the 7+ stop pipeline to ship.
2. **Two modes, one scene graph**: `easy` (analogy, ~2 sentences) vs `real`/Interview (correct terminology + extra unlocked hotspots + one quotable `interviewLine` per card). Mode is a global toggle, persisted, deep-linkable.
3. **Vanilla Three.js + GSAP, no React/R3F**: single-canvas story app; full loop control; smaller bundle.
4. **Content in `hops.json`, never in code**: text, hotspot anchors, camera poses all data-driven so writing/fact-checking doesn't touch scene code.
5. **Meshopt (gltfpack) over Draco; KTX2/Basis textures**: smaller + faster decode; textures stay compressed on GPU.
6. **Tripo only for ~8–12 hero props**; packets, cables, beams, particles are code geometry (0 bytes, always crisp).
7. **Deep-linkable states** (`#/dns/resolver?mode=real`) — built for launch-week distribution of individual hops.
8. **Bloom is the only post effect.** No shadow maps (baked blob shadows).

## Hard budgets
Total ≤ 25MB · hero ≤ 2.5MB (<3s on 4G) · per hop ≤ 4MB · 60fps desktop / ≥30fps 2022 mid-range phone · <150 draw calls.

## Non-goals (this version)
- No backend, no accounts, no quiz/scoring.
- No DB-internals or load-balancing deep dives — those are the **sequel series** on the same engine: (a) inside a database query / B-tree traversal in 3D, (b) a distributed system under load as a living scene.
- No exhaustive accuracy (keyboard interrupts, ARP frames) in Easy mode — acknowledged simplification, noted in-app where it matters.

## Milestone status
- [x] M0 skeleton — full journey navigable with placeholder cubes
- [x] M1 vertical slice — DNS hop at final quality (**go/no-go checkpoint**)
- [x] M2 all 6 hops + hero + finale
- [ ] M3 polish/perf/mobile + playtest
- [ ] M4 launch day (planned distribution day, not a cold drop)

## Glossary of hop IDs (used in code, content, URLs)
`browser` · `dns` · `tcp` · `tls` · `edge` · `server`

## Working notes
- Repo folder was empty at project start (2026-08-04); `git log` in this dir shows commits from an unrelated parent repo up the tree — **run `git init` here before first commit** so this project gets its own history.
- Style bible (master image prompt) to be written at M1 and pasted here once locked.

## Style bible (locked at M1)
Stylized low-poly network dioramas suspended in a near-black void; octagonal steel plinths, chamfered geometric machinery, cyan for active data paths, amber for handshakes/answers, violet for trust boundaries, restrained fog, thin luminous infrastructure lines, no realistic textures, no shadows, and continuous low-amplitude motion. Typography is technical but human: Manrope display copy with compact DM Mono telemetry.
