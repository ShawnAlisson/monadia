# Deploy MONADIA on Vercel

## What is live now

| Item | Monad Testnet value |
|---|---|
| Civilization contract | `0x347519Fed413D6B4BE396AEC81975702Dd9673B3` |
| MONADIA Coin | `0xb9adfA8094e14a421179fec34496d76abC46Eb02` |
| Network | Monad Testnet, chain ID `10143` |
| MDA supply at the last live check | `0 MDA` |
| Market liquidity at the last live check | `0 MON` |

The contracts are genuinely deployed. The MDA supply is zero simply because no one has completed `joinCivilization` yet. The first successful join mints 100 MDA to that wallet.

## Economy facts

- Giving 500 users 100 MDA each means minting **50,000 MDA**. The contract has no 50,000-MDA cap, so this is supported.
- MDA minting does **not** consume MON from your wallet. Each user still needs a little testnet MON to pay the gas for their own join transaction.
- MDA does **not** have a market price or a redeemable MON conversion in this version. The contract's tax accounting treats 1 MDA unit as 1 MON of trade value: a 1 MON trade has a 0.02 MDA tax at the current 2% rate. That is a game rule, not an exchange rate.
- Selling resources needs MON inside Civilization. Fund the market before presenting the Sell button in a public demo.

## 1. Create the Vercel database

MONADIA now uses Neon Postgres, not a local SQLite file. This is essential because Vercel functions have no persistent disk.

1. Create a free Neon project at [neon.tech](https://neon.tech), or add the Neon integration from Vercel's Storage tab.
2. Copy its pooled connection string. It begins with `postgresql://`.
3. Put it in both local `.env.local` and Vercel as `DATABASE_URL`.

Do not put the connection string in any `NEXT_PUBLIC_` variable.

## 2. Configure Vercel environment variables

In Vercel: **Project → Settings → Environment Variables**, add these for Production, Preview, and Development as appropriate.

```env
# Browser-safe values
NEXT_PUBLIC_CIVILIZATION_ADDRESS=0x347519Fed413D6B4BE396AEC81975702Dd9673B3
NEXT_PUBLIC_MONAD_RPC_URL=https://YOUR_RELIABLE_MONAD_RPC
NEXT_PUBLIC_EXPLORER_URL=https://testnet.monadvision.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_OPTIONAL_REOWN_PROJECT_ID

# Server-only values
DATABASE_URL=postgresql://...
MONAD_RPC_URL=https://YOUR_RELIABLE_MONAD_RPC
ENABLE_ONCHAIN=true
ENABLE_ONCHAIN_AI=false
CRON_SECRET=USE_A_LONG_RANDOM_SECRET
```

Start with `ENABLE_ONCHAIN_AI=false`. Human joins, trades, businesses, hires, and published votes settle on Monad and are receipt-verified. Autonomous AI settlement spends your developer-funded MON, so turn it on only after the optional agent-funding section below.

Use a dedicated Monad RPC provider for a public demo. The public RPC is appropriate for quick tests but may rate-limit a busy world.

Never add any of these to Vercel unless you deliberately enable on-chain AI:

```env
OPERATOR_PRIVATE_KEY=
PRIVATE_KEY=
AGENT_MNEMONIC=
```

They are server secrets. Never prefix them with `NEXT_PUBLIC_`.

## 3. Deploy the app

1. Push this project to GitHub.
2. In [Vercel](https://vercel.com), choose **Add New → Project** and import the repository.
3. Framework preset: **Next.js**. Keep the default build command: `npm run build`.
4. Add the variables above, then deploy.
5. Open this URL after deployment:

```text
https://YOUR-VERCEL-DOMAIN/api/health
```

Expected result:

```json
{"ok":true,"database":"connected","monadSettlement":true,"onchainAi":false}
```

If it says `database: "unavailable"`, the `DATABASE_URL` is missing or invalid. Do not invite users until `/api/health` is green.

## 4. Keep the simulation alive on Vercel

The repository includes `.github/workflows/simulation-tick.yml`. It calls the protected simulation endpoint every five minutes.

In your GitHub repository, add these Actions secrets:

```text
MONADIA_CRON_URL=https://YOUR-VERCEL-DOMAIN/api/cron/tick
CRON_SECRET=the exact same CRON_SECRET you put in Vercel
```

Then open **GitHub → Actions → MONADIA simulation tick → Run workflow** once. A successful response confirms your deployment can update the shared world.

Vercel's Hobby cron schedule is limited, so GitHub Actions is the included lightweight scheduler. For a high-traffic public launch, use Vercel Pro cron or a dedicated scheduler/worker with the same protected endpoint.

## 5. Fund the market before enabling sells

Your current deployer balance was **4.576157162995885021 MON** at the live check, and the market has **0 MON**. Start with 1–3 testnet MON, leaving MON for gas. Get more testnet MON from the Monad faucet if needed.

Run locally with the contract operator wallet loaded in your environment:

```bash
export MARKET_FUND_AMOUNT=1
npm run market:fund
```

This is a real testnet transaction. It can only be sent by the Civilization operator.

## 6. Publish the first governance proposal

The deployed v1 contract records votes on Monad, but tax-rate execution is still operator-controlled. The app deliberately marks a proposal as a draft until you publish it on-chain.

After `DATABASE_URL`, `NEXT_PUBLIC_CIVILIZATION_ADDRESS`, and the operator key are available locally:

```bash
export PROPOSAL_DURATION_SECONDS=86400
npm run proposals:publish
```

This publishes the default tax proposal to Monad and connects it to the Vercel read model. Users can then vote from the Governance screen.

## 7. Optional: put AI actions on-chain

Do this only after the human flow works. It spends your testnet MON and every AI wallet must be registered.

1. Generate and safely store a new agent mnemonic. Do not use the old public test mnemonic.
2. Set `AGENT_MNEMONIC`, `OPERATOR_PRIVATE_KEY`, `MONAD_RPC_URL`, `DATABASE_URL`, and `NEXT_PUBLIC_CIVILIZATION_ADDRESS` in your local terminal.
3. Fund the agent wallets. For 24 agents at 0.1 MON, this sends 2.4 MON plus gas:

   ```bash
   export AGENT_COUNT=24
   export FUND_AMOUNT=0.1
   npm run fund:agents
   ```

4. Register them with Civilization:

   ```bash
   export ENABLE_ONCHAIN_AI=true
   npm run agents:register
   ```

5. Add the same server-only secrets to Vercel, set `ENABLE_ONCHAIN_AI=true`, and redeploy.

Until this is enabled, agent buildings are a persistent shared simulation; human economic actions are still real receipt-verified Monad transactions.

## Production acceptance check

Run these before sharing the app with voters:

```bash
npm run build
npm run lint
npm run contracts:test
```

Then test in the deployed app:

1. `/api/health` returns green.
2. Connect a fresh Monad Testnet wallet with faucet MON.
3. Join once and verify 100 MDA on MonadVision.
4. Buy one Food unit and verify the transaction hash appears in the world feed.
5. Fund the market, then sell one unit and confirm it pays MON back.
6. Publish a proposal and cast one vote.
7. Test the 3D world with keyboard and a real mobile device.

## Honest current boundaries

- This is Monad **Testnet**. MDA and MON here are not real-money assets.
- The app has a shared world and visible human avatars, but it does not yet have a true online-presence/chat service. Add Ably, Pusher, or Supabase Realtime if you need a precise live “who is online” indicator.
- Postgres is the UI/read-model store. Contract receipts are verified before human economic actions are recorded; on-chain balances and inventory remain the settlement truth.
- The current v1 voting contract records votes, but it does not autonomously execute a tax change. A governed executor requires a v2 contract deployment and audit before mainnet.
