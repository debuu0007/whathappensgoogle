#!/usr/bin/env bash
set -euo pipefail
src_dir="${1:-public/models-source}"
out_dir="${2:-public/models-optimized}"
mkdir -p "$out_dir"
if ! command -v gltfpack >/dev/null 2>&1; then
  echo "gltfpack is required. Install meshoptimizer, then rerun npm run assets."
  exit 1
fi
for input in "$src_dir"/*.glb; do
  [ -e "$input" ] || continue
  name="$(basename "$input" .glb)"
  tmp="$(mktemp -d)/$name.glb"
  npx gltf-transform dedup "$input" "$tmp"
  npx gltf-transform weld "$tmp" "$tmp"
  npx gltf-transform simplify "$tmp" "$tmp" --ratio 0.75 --error 0.001
  npx gltf-transform resize "$tmp" "$tmp" --width 1024 --height 1024
  npx gltf-transform etc1s "$tmp" "$tmp"
  gltfpack -i "$tmp" -o "$out_dir/$name.glb" -cc
done
