# MAINSPRING — Costs

The only thing that ever costs money is an always-on server, and you only need one if you want multi-device sync. Everything else — the data, the math, the libraries, the fonts — is free and runs on hardware you control.

| Item | Cost |
|---|---|
| Desktop app (Tauri, runs on your machine) | $0 |
| Local stores (PGlite, DuckDB) | $0 |
| Money engine, Rust kernel, all libraries (OSS) | $0 |
| Charts (uPlot, Observable Plot) | $0 |
| Fonts (Cinzel, Spectral, JetBrains Mono — open source) | $0 |
| Market data (yfinance + Finnhub free tiers) | $0 |
| **Single-device total** | **$0** |
| Optional: multi-device sync (1× Hetzner CX22 running Postgres + ElectricSQL) | ~€4–5/mo |
| Optional: web build hosting (Cloudflare Pages) | ~$0 |
| Optional: hosted LLM calls for AI copilot (if you skip local inference) | pay-per-use; abstract the data first |

Re-verify Finnhub / Twelve Data free-tier terms before launch — API pricing drifts. yfinance is unofficial; the local cache is your insulation against it breaking.

**Realistic total: $0 as a private desktop app; ~€5/mo only if you want it synced across devices.**
