# MONADIA

MONADIA is a shared 3D civilization for Monad Testnet: real people join with wallets and move through a third-person city; AI agents live as fixed, clickable buildings that users can inspect and hire.

## Live Monad Testnet contracts

| Contract | Address |
|---|---|
| Civilization | `0x347519Fed413D6B4BE396AEC81975702Dd9673B3` |
| MONADIA Coin (MDA) | `0xb9adfA8094e14a421179fec34496d76abC46Eb02` |
| Network | Monad Testnet (`10143`) |

`joinCivilization` mints 100 MDA once per wallet. MDA is a civic game token; it has no independent MON exchange rate in this version. Trade tax is 2% in MDA using the contract's 1 MDA-per-1-MON-value accounting rule.

## What works

- Wallet connect and receipt-verified Monad citizenship
- 100 MDA on-chain welcome airdrop
- On-chain resource buys, sells, business stakes, AI hires, and published votes
- Server-side transaction verification: the database will not trust browser-provided amounts or transaction hashes
- Shared Vercel-compatible Postgres read model, event feed, and scheduled simulation tick
- Third-person Three.js city: WASD on desktop, pointer-safe touch controls on mobile
- Humans appear as moving avatars; AI agents appear only as fixed district buildings
- Compact world HUD with direct routes to market, governance, and AI agent terminals

## Quick start

```bash
npm install
cp .env.example .env.local
```

Create a Neon database and set `DATABASE_URL` in `.env.local`. Then set the deployed Civilization address and run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Important commands

```bash
npm run build
npm run lint
npm run contracts:test
npm run market:fund
npm run proposals:publish
npm run fund:agents
npm run agents:register
```

Commands that can spend testnet MON require explicit environment variables and refuse to use a public demo mnemonic.

## Deployment

See [PRODUCTION.md](./PRODUCTION.md) for the complete Vercel, Neon, scheduler, market-liquidity, governance, and optional on-chain-AI checklist.

## Architecture

- Next.js + TypeScript + Tailwind
- Three.js / React Three Fiber for the world
- wagmi + viem for Monad wallet and receipt verification
- Solidity + Foundry for `Civilization` and `MonadiaCoin`
- Neon Postgres for persistent shared world data on Vercel
- GitHub Actions → protected `/api/cron/tick` endpoint for serverless simulation scheduling

## Current scope

MONADIA is a Monad Testnet hackathon application. Its 3D world is shared through the database and polling; a true online-presence/chat service is the next integration if exact live user presence is required. Governance votes are on-chain when a proposal is published, but the v1 contract does not autonomously execute tax changes.
