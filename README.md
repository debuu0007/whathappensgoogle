# What happens when you hit Enter on google.com?

An explorable Three.js packet journey through the browser, DNS, TCP, TLS, Google’s edge, and the server/rendering pipeline. The camera is the packet.

## Run it

```bash
npm install
npm run dev
```

Create the static production build with `npm run build`; deploy the generated `dist/` directory to any static host. `npm run assets` optimizes future GLB files from `public/models-source/` into Meshopt/KTX2-ready output.

## Controls

- Enter or tap to launch
- Click/tap glowing hotspots to focus
- Drag while focused to orbit within a limited range
- Left/Right arrows, swipe, or the progress rail to travel
- Escape to leave a focused hotspot
- Toggle Easy/Interview at any time

Deep links use `#/hop/hotspot?mode=real`, for example `#/dns/resolver?mode=real`.

## Architecture

Vanilla Three.js, GSAP, pmndrs `postprocessing`, and DOM-based UI run from one strict state machine. All narrative copy, camera poses, mesh anchors, and source links live in `src/content/hops.json`. Procedural dioramas resolve through `src/assets/manifest.js`, where any set-piece can later opt into a compressed GLB without changing scene logic.

Interview-mode content is condensed from [alex/what-happens-when](https://github.com/alex/what-happens-when) and current MDN references linked in each card.
