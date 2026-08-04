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
  work_dir="$(mktemp -d)"
  npx gltf-transform dedup "$input" "$work_dir/01-dedup.glb"
  npx gltf-transform weld "$work_dir/01-dedup.glb" "$work_dir/02-weld.glb"
  npx gltf-transform simplify "$work_dir/02-weld.glb" "$work_dir/03-simple.glb" --ratio 0.75 --error 0.001
  npx gltf-transform resize "$work_dir/03-simple.glb" "$work_dir/04-resized.glb" --width 1024 --height 1024
  npx gltf-transform etc1s "$work_dir/04-resized.glb" "$work_dir/05-ktx.glb"
  gltfpack -i "$work_dir/05-ktx.glb" -o "$out_dir/$name.glb" -cc
  rm -r "$work_dir"
done
