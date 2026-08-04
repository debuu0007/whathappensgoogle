# Asset and bundle log

All current dioramas are procedural geometry, so model transfer is **0 bytes**. This log records production build output at each checkpoint.

| Milestone | JS (raw) | CSS (raw) | External models | Notes |
|---|---:|---:|---:|---|
| M0 | 661.5 kB (177.9 kB gzip) | 8.4 kB (2.8 kB gzip) | 0 B | Six-hop rail and placeholder geometry; hero interactive payload stays well below 2.5 MB |
| M1 | 850.9 kB (237.2 kB gzip) | 8.4 kB (2.8 kB gzip) | 0 B | DNS vertical slice plus future GLB loaders; still 9.5% of the 2.5 MB hero budget gzip |
| M2 | 862.5 kB (241.0 kB gzip) | 10.6 kB (3.4 kB gzip) | 0 B | All six procedural dioramas, 1,800 instanced edge packets, hero browser, finale page assembly; total transfer remains under 0.25 MB gzip |
| M3 | 744.9 kB initial (201.4 kB gzip) | 11.7 kB (3.6 kB gzip) | 0 B | GLB loader split out (43.0 kB gzip on demand); complete `dist/` with source maps and self-hosted Basis decoder is 5.9 MB |
