# P1 / PCO lifecycle prototype

The canonical Poke-hosted prototype is `p1-pco-lifecycle`. Its application inventory includes React/TypeScript source, Vite/TanStack configuration, package lockfile, public fonts/assets, and screens for statement, activation, pulse, dispatch, risk, and spawner.

## Source inventory
- `src/components/screens/statement.tsx`
- `src/components/screens/activation.tsx`
- `src/components/screens/pulse.tsx`
- `src/components/screens/dispatch.tsx`
- `src/components/screens/risk.tsx`
- `src/components/screens/spawner.tsx`
- `src/components/charts.tsx`, `chrome.tsx`, `data.ts`, `primitives.tsx`
- `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/router.tsx`
- `src/styles.css`, `src/poke-defaults.css`
- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `tsr.config.json`

This repository is the portable documentation and architecture package. The prototype's canonical deployed project remains privately hosted as `p1-pco-lifecycle`; copy the inventory above from that project when exporting the application source through the project workspace.
