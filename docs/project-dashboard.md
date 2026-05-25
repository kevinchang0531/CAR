# CAR Project Dashboard

## Status

- 2026-05-26: Project initialized locally.
- Git repository created, but branch rename/config updates hit a Windows permission lock during setup.
- 2026-05-26: Built a local Lexus CPO inventory ranking website with live official inventory proxy, new-car price, CPO sale price, discount, and CP ranking.
- 2026-05-26: Added Tesla inventory using the public `electrify.tw/app/inventory/data.json` source.
- 2026-05-26: Created and pushed public GitHub repository `https://github.com/kevinchang0531/CAR`.
- 2026-05-26: Fixed Tesla model-series detection so Model Y, Model S, and Model X appear correctly in filters.

## Current Files

- `AGENTS.md`: collaboration and project rules
- `README.md`: human-facing project overview
- `.gitignore`: protective ignore rules
- `docs/project-dashboard.md`: setup and progress record
- `server.js`: local server and Lexus CPO API proxy
- `public/`: website UI, styles, and ranking logic
- `package.json`: local development command

## Next Practical Step

Review the Lexus CPO CP scoring weights after trying the first ranking:

- Discount rate from new-car price to CPO sale price
- Mileage penalty
- Vehicle age penalty
- Equipment completeness bonus

Also review Tesla CP scoring baseline:

- New Tesla rows currently use sale price as new-car price, so discount is zero by design.
- Used Tesla rows use model/trim baseline prices for Model 3 and Model Y.
- Model S and Model X baseline prices should be filled in if they become purchase candidates.

## Setup Notes

- If Git branch/config commands keep failing with lock or permission errors, retry after closing file explorers, editors, sync tools, or security scans that may be holding `.git` files.
- Intended branch name: `main`.
- Local website command: `npm run dev`
- Local URL: `http://localhost:4174`
- Tesla inventory source: `https://electrify.tw/app/inventory/data.json`
- GitHub repository: `https://github.com/kevinchang0531/CAR`
