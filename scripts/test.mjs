// Deploys GodelCoin into an in-memory EVM and exercises the ERC-20 surface.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { keccak256, hexToBytes, bytesToHex, encodeAbiParameters, decodeAbiParameters, toHex, pad } from 'viem';
const require = createRequire(import.meta.url);
const { VM } = require('@ethereumjs/vm');
const { Common, Chain, Hardfork } = require('@ethereumjs/common');
const { Address, Account } = require('@ethereumjs/util');
const createAddressFromString = (s) => Address.fromString(s);

const solc = require('solc');
const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'GodelCoin.sol': { content: readFileSync('contracts/GodelCoin.sol', 'utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
const artifact = out.contracts['GodelCoin.sol'].GodelCoin;

const sel = (sig) => keccak256(new TextEncoder().encode(sig)).slice(0, 10);
const addr32 = (a) => pad(a, { size: 32 }).slice(2);
const u32 = (n) => pad(toHex(n), { size: 32 }).slice(2);

const DEPLOYER = '0x1111111111111111111111111111111111111111';
const ALICE = '0x2222222222222222222222222222222222222222';
const BOB = '0x3333333333333333333333333333333333333333';
const TREASURY = DEPLOYER;

const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun });
const vm = await VM.create({ common });

let contractAddr;
async function run(caller, to, data) {
  const res = await vm.evm.runCall({
    caller: createAddressFromString(caller),
    origin: createAddressFromString(caller),
    to: to ? createAddressFromString(to) : undefined,
    data: hexToBytes(data),
    gasLimit: 30000000n,
    value: 0n,
  });
  return res;
}

// fund senders
for (const a of [DEPLOYER, ALICE, BOB]) {
  await vm.stateManager.putAccount(createAddressFromString(a), new Account(0n, 10n ** 20n));
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// deploy
const deployRes = await run(DEPLOYER, null, '0x' + artifact.evm.bytecode.object + addr32(TREASURY));
if (deployRes.execResult.exceptionError) throw new Error('deploy failed: ' + deployRes.execResult.exceptionError.error);
contractAddr = deployRes.createdAddress.toString();
console.log('deployed at', contractAddr);

const call = async (caller, data) => run(caller, contractAddr, data);
const num = (res) => BigInt(bytesToHex(res.execResult.returnValue) || '0x0');
const reverted = (res) => !!res.execResult.exceptionError;

const SUPPLY = 1_931_000_000n * 10n ** 18n;

check('totalSupply == 1.931B', await call(DEPLOYER, sel('totalSupply()')).then(num) === SUPPLY);
check('treasury holds full supply', await call(DEPLOYER, sel('balanceOf(address)') + addr32(TREASURY)).then(num) === SUPPLY);

// transfer
await call(DEPLOYER, sel('transfer(address,uint256)') + addr32(ALICE) + u32(1000n));
check('alice balance 1000', await call(DEPLOYER, sel('balanceOf(address)') + addr32(ALICE)).then(num) === 1000n);

// transfer more than balance reverts
check('overspend reverts', reverted(await call(ALICE, sel('transfer(address,uint256)') + addr32(BOB) + u32(5000n))));

// transfer to zero reverts
check('transfer to 0x0 reverts', reverted(await call(ALICE, sel('transfer(address,uint256)') + addr32('0x0000000000000000000000000000000000000000') + u32(1n))));

// approve + transferFrom
await call(ALICE, sel('approve(address,uint256)') + addr32(BOB) + u32(400n));
check('allowance set', await call(ALICE, sel('allowance(address,address)') + addr32(ALICE) + addr32(BOB)).then(num) === 400n);
await call(BOB, sel('transferFrom(address,address,uint256)') + addr32(ALICE) + addr32(BOB) + u32(400n));
check('bob received 400', await call(BOB, sel('balanceOf(address)') + addr32(BOB)).then(num) === 400n);
check('allowance consumed', await call(BOB, sel('allowance(address,address)') + addr32(ALICE) + addr32(BOB)).then(num) === 0n);
check('transferFrom past allowance reverts', reverted(await call(BOB, sel('transferFrom(address,address,uint256)') + addr32(ALICE) + addr32(BOB) + u32(1n))));

// infinite allowance is not decremented
const MAX = (1n << 256n) - 1n;
await call(ALICE, sel('approve(address,uint256)') + addr32(BOB) + u32(MAX));
await call(BOB, sel('transferFrom(address,address,uint256)') + addr32(ALICE) + addr32(BOB) + u32(100n));
check('infinite allowance stays infinite', await call(BOB, sel('allowance(address,address)') + addr32(ALICE) + addr32(BOB)).then(num) === MAX);

// burn
const before = await call(BOB, sel('totalSupply()')).then(num);
await call(BOB, sel('burn(uint256)') + u32(500n));
check('burn cuts totalSupply', await call(BOB, sel('totalSupply()')).then(num) === before - 500n);
check('burn past balance reverts', reverted(await call(BOB, sel('burn(uint256)') + u32(10n ** 30n))));

// no mint function exists
check('no mint(address,uint256) selector', reverted(await call(DEPLOYER, sel('mint(address,uint256)') + addr32(BOB) + u32(1n))));

// lore
check('isComplete() == false', await call(DEPLOYER, sel('isComplete()')).then(num) === 0n);
check('isConsistent() == true', await call(DEPLOYER, sel('isConsistent()')).then(num) === 1n);
check('godelNumber is nonzero', await call(DEPLOYER, sel('godelNumber(address)') + addr32(ALICE)).then(num) > 0n);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
