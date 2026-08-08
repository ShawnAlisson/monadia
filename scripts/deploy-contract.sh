#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Set PRIVATE_KEY (hex, with or without 0x) for the deployer wallet."
  exit 1
fi

# Wallet exports sometimes contain a line break or spaces. Normalize locally,
# but never print the secret.
KEY="$(printf '%s' "$PRIVATE_KEY" | tr -d '[:space:]')"
KEY="${KEY#0x}"
KEY="${KEY#0X}"

if [[ ! "$KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "PRIVATE_KEY must contain exactly 64 hexadecimal characters (with or without 0x)."
  echo "Check that you exported the private key, not the wallet address or seed phrase."
  exit 1
fi

KEY="0x$KEY"

RPC="${MONAD_RPC_URL:-https://testnet-rpc.monad.xyz}"

cd "$ROOT/contracts"
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC" \
  --broadcast \
  --private-key "$KEY"

echo ""
echo "Copy the deployed address into NEXT_PUBLIC_CIVILIZATION_ADDRESS"
echo "Fund the market/operator and AI wallets next (scripts/fund-agents.ts)."
