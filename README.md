# $GODEL — the incompleteness memecoin

> Every sufficiently powerful terminal contains a coin it cannot price.

An **unofficial, unaffiliated** fan memecoin inspired by [Godel Terminal](https://godelterminal.com)
(@shkreloi). It is a joke and a Solidity exercise. It is not an investment, not a security,
and not endorsed by Godel Terminal or anyone associated with it.

## Tokenomics

| | |
|---|---|
| Ticker | `GODEL` |
| Supply | 1,931,000,000 — for 1931, the year the incompleteness theorems shipped |
| Decimals | 18 |
| Buy/sell tax | 0 / 0 |
| Mint function | does not exist |
| Owner / admin / proxy | none |
| Only supply operation | `burn()`, and it only goes down |

The whole contract is 100 lines with no imports. Everything it can ever do is in
`contracts/GodelCoin.sol`; there is no second contract, no upgrade path, and no privileged address.
That is the entire pitch: a memecoin you can finish reading.

## Lore functions

```solidity
isComplete()          // false
isConsistent()        // true — you cannot verify this from in here
godelNumber(address)  // keccak("G(" || holder || ")")
theorem()             // "This token is not provable within this token."
```

## Layout

```
contracts/GodelCoin.sol   the token (transferable)
contracts/GodelCoinBound.sol  soulbound variant: fixed supply, one holder, cannot move
contracts/QuantumCoin.sol $QBIT, the observer-effect companion coin
test/GodelCoin.t.sol      Foundry tests (needs forge + forge-std)
scripts/compile.js        solc compile -> build-abi.json
scripts/test.mjs          deploys into an in-memory EVM and asserts behavior (no forge needed)
scripts/test-bound.mjs    17 assertions that the soulbound variant cannot move, from any caller
scripts/test-quantum.mjs  38 assertions: superposition, collapse, entanglement, accounting
docs/                     GitHub Pages site (index.html, 404.html, .nojekyll)
```

## Run it

```bash
npm install
node scripts/compile.js   # compiles, writes build-abi.json
node scripts/test.mjs     # 16 checks against a real EVM
forge test                # optional, if you have foundry installed
open docs/index.html
```

## Two variants

**`GodelCoin.sol`** — a normal fixed-supply ERC-20. Transferable, therefore tradable,
therefore something a stranger can lose money on.

**`GodelCoinBound.sol`** — the same joke with the exit welded shut. The full supply is minted
once to a single immutable `holder`, and `transfer`, `transferFrom` and `approve` all revert
unconditionally — for the holder as much as for anyone else. Even a zero-value transfer reverts,
so a DEX router probing the token fails before it can pool it. `allowance()` is always 0.
The holder may `burn()`, and that is the only state change the contract will ever accept.

It is deliberately **not** ERC-20 compliant. The read surface matches so wallets and explorers
render a balance, but nothing can move. There is no market, no price, and no way for anyone to
buy it from you — which means there is no one to be hurt by it. That is the point of the variant,
not a limitation of it.

```bash
node scripts/test-bound.mjs   # 17 checks, including transfer attempts from a stranger
```

## $QBIT — QuantumCoin

The companion coin. Where $GODEL cannot prove itself, $QBIT cannot be counted until you look.

`balanceOf` on a superposed address returns a **live draw** — a real number from your amplitude
that changes every block and is not what you will get. `measure()` collapses it once, permanently,
and only a collapsed balance can be transferred. You cannot send to an address that has not
collapsed either: an observed token may never re-enter a superposition.

`entangle(addr)` is mutual — it binds only when both parties name each other. Entangled pairs
collapse together and **anticorrelated**: the two draws sum to exactly `2 * QUANTUM`, so measuring
yours determines theirs. The partner's share is reserved before either collapse is written, so a
depleted reserve can never leave a pair half-collapsed.

Supply is 6,626,070,150 — Planck's constant with the exponent thrown away. It is accounted for
exactly at every step: `totalMeasured + reserve + burned == MAX_SUPPLY`, asserted after each
operation in the test suite.

Two honest caveats, stated in the contract as well:

- **Not ERC-20 compliant, on purpose.** A non-deterministic `balanceOf` is something no wallet
  expects. That is the joke; do not pool it.
- **The randomness is not secure.** It is `prevrandao`-based, so a validator can influence its own
  collapse. Thematically acceptable for a coin about the impossibility of knowing things — but
  never reuse the pattern where money depends on the outcome.

```bash
node scripts/test-quantum.mjs   # 38 checks
```

## The GitHub Pages lander

`docs/` is a self-contained static site — no build step, no dependencies, no external requests.
To publish it:

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/docs`, Save.
3. It goes live at `https://<user>.github.io/<repo>/` in a minute or two.

Before publishing, replace the two `dylanquesada` placeholders in `docs/index.html`
with your GitHub handle so the repo links resolve.

The page states it is unofficial in the browser tab title, the `og:` description (so link
previews carry it), a sticky red banner that stays on screen through the whole scroll, the
hero kicker, two bordered disclaimer panels, and the footer. It also says plainly that no
token is deployed or for sale and that any address claiming to be $GODEL is not.

## Deploying

`constructor(address treasury)` mints the full supply to `treasury` and that is the last
privileged thing that ever happens. If you deploy this:

- Do not brand it as an official Godel Terminal token. It isn't one.
- Assume the value is zero. That is the correct price for a coin whose whitepaper is a punchline.
- Verify the source on the explorer so holders can read the 100 lines themselves.

MIT licensed. `G(x) ≡ ¬Prov(⌜G(x)⌝)`
