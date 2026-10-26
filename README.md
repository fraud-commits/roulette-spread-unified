# Roulette Spread — Unified

Standalone test copy. The original `ROULETTE-main`, `DT-LAYOUT-main`, and `AMERICAN-ROULETTE-main` folders are unchanged.

## Local demo

Open this folder in a local web server (for example, VS Code Live Server). To use Python:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

- `http://localhost:8000/?demo=missing` — demo without a Winning Number column.
- `http://localhost:8000/?demo=win` — demo with a Winning Number column.

The page includes wheel and currency selectors. For Tableau data, the extension expects the `work2` worksheet and columns described in `js/application.js`.

## Tableau

Install `RouletteSpread.trex` from Tableau's **My Extensions** folder. The manifest points to the hosted GitHub Pages version.
