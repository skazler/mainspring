# MAINSPRING — Costs

The only thing that ever costs money is an always-on server, and you only need one if you want multi-device sync. Everything else — the data, the math, the libraries, the fonts — is free and runs on hardware you control.

Rows marked **(on the bench)** are designed-for but not yet fitted (see the README parts list).

| Item | Cost |
|---|---|
| Desktop app (Tauri, runs on your machine) | $0 |
| Local store (PGlite) | $0 |
| Money engine, Rust kernel, all libraries (OSS) | $0 |
| Charts (uPlot) | $0 |
| Fonts (Cinzel, Spectral, JetBrains Mono — open source) | $0 |
| Market data (Yahoo Finance v8 chart endpoint, free/no key) | $0 |
| **Single-device total** | **$0** |
| DuckDB analytics *(on the bench)* | $0 |
| Finnhub live quotes *(on the bench, needs a key)* | $0 free tier |
| Multi-device sync — Postgres + ElectricSQL *(on the bench)* | ~€4–5/mo (1× Hetzner CX22) |
| Optional: web build hosting (Cloudflare Pages) | ~$0 |
| Optional: hosted LLM calls for the Almanac (bring your own key) | pay-per-use |

The market data path is the free Yahoo chart endpoint with an aggressive local cache; it's unofficial, so treat it as best-effort.

**Realistic total: $0 as a private desktop app; ~€5/mo only if you want it synced across devices.**
