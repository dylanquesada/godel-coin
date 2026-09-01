// Deploys GodelCoinBound into an in-memory EVM and proves nothing can move.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { keccak256, hexToBytes, bytesToHex, toHex, pad } from 'viem';
const require = createRequire(import.meta.url);
const { VM } = require('@ethereumjs/vm');
const { Common, Chain, Hardfork } = require('@ethereumjs/common');
const { Address, Account } = require('@ethereumjs/util');
const createAddressFromString = (s) => Address.fromString(s);
const solc = require('solc');

const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'C.sol': { content: readFileSync('contracts/GodelCoinBound.sol', 'utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
const artifact = out.contracts['C.sol'].GodelCoinBound;

const sel = (sig) => keccak256(new TextEncoder().encode(sig)).slice(0, 10);
const addr32 = (a) => pad(a, { size: 32 }).slice(2);
const u32 = (n) => pad(toHex(n), { size: 32 }).slice(2);

const HOLDER = '0x1111111111111111111111111111111111111111';
const ATTACKER = '0x2222222222222222222222222222222222222222';

const vm = await VM.create({ common: new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun }) });
for (const a of [HOLDER, ATTACKER]) {
  await vm.stateManager.putAccount(createAddressFromString(a), new Account(0n, 10n ** 20n));
}

async function run(caller, to, data) {
  return vm.evm.runCall({
    caller: createAddressFromString(caller), origin: createAddressFromString(caller),
    to: to ? createAddressFromString(to) : undefined,
    data: hexToBytes(data), gasLimit: 30000000n, value: 0n,
  });
}

const deploy = await run(HOLDER, null, '0x' + artifact.evm.bytecode.object + addr32(HOLDER));
if (deploy.execResult.exceptionError) throw new Error('deploy failed');
const C = deploy.createdAddress.toString();
console.log('deployed at', C);

const call = (caller, data) => run(caller, C, data);
const num = (r) => BigInt(bytesToHex(r.execResult.returnValue) || '0x0');
const reverted = (r) => !!r.execResult.exceptionError;

let pass = 0, fail = 0;
const check = (n, c) => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n}`)); };

const SUPPLY = 1_931_000_000n * 10n ** 18n;

check('holder has 100% of supply', await call(HOLDER, sel('balanceOf(address)') + addr32(HOLDER)).then(num) === SUPPLY);
check('totalSupply == 1.931B', await call(HOLDER, sel('totalSupply()')).then(num) === SUPPLY);
check('holder() is immutable owner-of-record', BigInt(bytesToHex((await call(HOLDER, sel('holder()'))).execResult.returnValue)) === BigInt(HOLDER));

// the wall: every movement path, from both the holder and a stranger
check('holder cannot transfer', reverted(await call(HOLDER, sel('transfer(address,uint256)') + addr32(ATTACKER) + u32(1n))));
check('stranger cannot transfer', reverted(await call(ATTACKER, sel('transfer(address,uint256)') + addr32(HOLDER) + u32(1n))));
check('holder cannot approve', reverted(await call(HOLDER, sel('approve(address,uint256)') + addr32(ATTACKER) + u32(1n))));
check('stranger cannot approve', reverted(await call(ATTACKER, sel('approve(address,uint256)') + addr32(ATTACKER) + u32(1n))));
check('transferFrom reverts', reverted(await call(ATTACKER, sel('transferFrom(address,address,uint256)') + addr32(HOLDER) + addr32(ATTACKER) + u32(1n))));
check('transfer of 0 also reverts (no DEX probe passes)', reverted(await call(HOLDER, sel('transfer(address,uint256)') + addr32(ATTACKER) + u32(0n))));
check('allowance always 0', await call(ATTACKER, sel('allowance(address,address)') + addr32(HOLDER) + addr32(ATTACKER)).then(num) === 0n);

// balance is provably unchanged after every attempt
check('holder balance untouched', await call(HOLDER, sel('balanceOf(address)') + addr32(HOLDER)).then(num) === SUPPLY);
check('attacker still has zero', await call(ATTACKER, sel('balanceOf(address)') + addr32(ATTACKER)).then(num) === 0n);

// burn: holder only
check('stranger cannot burn', reverted(await call(ATTACKER, sel('burn(uint256)') + u32(1n))));
const before = await call(HOLDER, sel('totalSupply()')).then(num);
await call(HOLDER, sel('burn(uint256)') + u32(500n));
check('holder can burn own supply', await call(HOLDER, sel('totalSupply()')).then(num) === before - 500n);
check('burn past balance reverts', reverted(await call(HOLDER, sel('burn(uint256)') + u32(10n ** 40n))));

check('no mint selector', reverted(await call(HOLDER, sel('mint(address,uint256)') + addr32(HOLDER) + u32(1n))));
check('isTransferable() == false', await call(HOLDER, sel('isTransferable()')).then(num) === 0n);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
