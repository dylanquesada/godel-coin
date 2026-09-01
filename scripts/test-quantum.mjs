// Deploys QuantumCoin into an in-memory EVM: superposition, collapse, entanglement, accounting.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { keccak256, hexToBytes, bytesToHex, toHex, pad } from 'viem';
const require = createRequire(import.meta.url);
const { VM } = require('@ethereumjs/vm');
const { Common, Chain, Hardfork } = require('@ethereumjs/common');
const { Address, Account } = require('@ethereumjs/util');
const { Block } = require('@ethereumjs/block');
const createAddressFromString = (s) => Address.fromString(s);
const solc = require('solc');

const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'C.sol': { content: readFileSync('contracts/QuantumCoin.sol', 'utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
const artifact = out.contracts['C.sol'].QuantumCoin;

const sel = (s) => keccak256(new TextEncoder().encode(s)).slice(0, 10);
const addr32 = (a) => pad(a, { size: 32 }).slice(2);
const u32 = (n) => pad(toHex(n), { size: 32 }).slice(2);

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
const D = '0x4444444444444444444444444444444444444444';

const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Cancun });
const vm = await VM.create({ common });
for (const a of [A, B, C, D]) {
  await vm.stateManager.putAccount(createAddressFromString(a), new Account(0n, 10n ** 20n));
}

let blockNum = 1n;
const mkBlock = (n) => Block.fromBlockData({ header: { number: n, difficulty: 0n, mixHash: hexToBytes(pad(toHex(n * 7919n), { size: 32 })), gasLimit: 30000000n } }, { common });

async function run(caller, to, data, atBlock) {
  return vm.evm.runCall({
    caller: createAddressFromString(caller), origin: createAddressFromString(caller),
    to: to ? createAddressFromString(to) : undefined,
    data: hexToBytes(data), gasLimit: 30000000n, value: 0n,
    block: mkBlock(atBlock ?? blockNum),
  });
}

const dep = await run(A, null, '0x' + artifact.evm.bytecode.object);
if (dep.execResult.exceptionError) throw new Error('deploy failed: ' + dep.execResult.exceptionError.error);
const CT = dep.createdAddress.toString();
console.log('deployed at', CT);

const call = (caller, data, atBlock) => run(caller, CT, data, atBlock);
const num = (r) => BigInt(bytesToHex(r.execResult.returnValue) || '0x0');
const reverted = (r) => !!r.execResult.exceptionError;
const get = async (fn, args = '', caller = A, atBlock) => num(await call(caller, sel(fn) + args, atBlock));

let pass = 0, fail = 0;
const check = (n, c, extra = '') => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${extra}`)); };

const MAX = 6_626_070_150n * 10n ** 18n;
const QUANTUM = MAX / 100_000n;
const invariant = async () =>
  (await get('totalMeasured()')) + (await get('reserve()')) + (await get('burned()')) === MAX;

check('reserve starts at full supply', await get('reserve()') === MAX);
check('totalSupply() is 0 before anyone measures', await get('totalSupply()') === 0n);
check('unsuperposed address reads 0', await get('balanceOf(address)', addr32(A)) === 0n);
check('cannot measure without superposing', reverted(await call(A, sel('measure()'))));

// superposition
await call(A, sel('superpose()'));
check('double superpose reverts', reverted(await call(A, sel('superpose()'))));
const at5 = await get('balanceOf(address)', addr32(A), A, 5n);
const at6 = await get('balanceOf(address)', addr32(A), A, 6n);
const at7 = await get('balanceOf(address)', addr32(A), A, 7n);
check('superposed balance differs across blocks', at5 !== at6 && at6 !== at7, `${at5} ${at6} ${at7}`);
check('superposed draws stay within [0, 2*QUANTUM]', [at5, at6, at7].every(v => v <= 2n * QUANTUM));
check('same block => same draw (view is deterministic per block)', await get('balanceOf(address)', addr32(A), A, 5n) === at5);
check('superposed cannot transfer', reverted(await call(A, sel('transfer(address,uint256)') + addr32(B) + u32(1n))));
check('superposed cannot approve', reverted(await call(A, sel('approve(address,uint256)') + addr32(B) + u32(1n))));
check('accounting holds while superposed', await invariant());

// collapse
blockNum = 11n;
await call(A, sel('measure()'));
const collapsed = await get('balanceOf(address)', addr32(A));
check('measure() marks observed', await get('isObserved(address)', addr32(A)) === 1n);
check('collapsed balance is stable across blocks',
  await get('balanceOf(address)', addr32(A), A, 50n) === collapsed && await get('balanceOf(address)', addr32(A), A, 99n) === collapsed);
check('collapsed value <= 2*QUANTUM', collapsed <= 2n * QUANTUM);
check('totalSupply() now equals the collapsed amount', await get('totalSupply()') === collapsed);
check('reserve fell by exactly the collapsed amount', await get('reserve()') === MAX - collapsed);
check('accounting holds after collapse', await invariant());
check('double measure reverts', reverted(await call(A, sel('measure()'))));

// transfers require both sides observed
check('cannot send to an unobserved address', reverted(await call(A, sel('transfer(address,uint256)') + addr32(B) + u32(1n))));
await call(B, sel('superpose()'));
check('cannot send to a merely superposed address', reverted(await call(A, sel('transfer(address,uint256)') + addr32(B) + u32(1n))));
await call(B, sel('measure()'));
const bBefore = await get('balanceOf(address)', addr32(B));
await call(A, sel('transfer(address,uint256)') + addr32(B) + u32(1000n));
check('transfer works once both have collapsed', await get('balanceOf(address)', addr32(B)) === bBefore + 1000n);
check('sender debited', await get('balanceOf(address)', addr32(A)) === collapsed - 1000n);
check('accounting holds after transfer', await invariant());

// entanglement
await call(C, sel('superpose()'));
await call(D, sel('superpose()'));
await call(C, sel('entangle(address)') + addr32(D));
check('one-sided entangle does not bind', await get('entangledWith(address)', addr32(C)) === 0n);
await call(D, sel('entangle(address)') + addr32(C));
check('mutual entangle binds both ways',
  (await get('entangledWith(address)', addr32(C))) === BigInt(D) && (await get('entangledWith(address)', addr32(D))) === BigInt(C));
check('cannot entangle self', reverted(await call(C, sel('entangle(address)') + addr32(C))));

blockNum = 21n;
await call(C, sel('measure()'));
const cVal = await get('balanceOf(address)', addr32(C));
const dVal = await get('balanceOf(address)', addr32(D));
check('measuring one collapses the other', await get('isObserved(address)', addr32(D)) === 1n);
check('entangled pair is anticorrelated (sums to 2*QUANTUM)', cVal + dVal === 2n * QUANTUM, `${cVal}+${dVal}`);
check('partner cannot measure again', reverted(await call(D, sel('measure()'))));
check('accounting holds after entangled collapse', await invariant());

// burn
const tmBefore = await get('totalMeasured()');
const reserveBefore = await get('reserve()');
const bBalBefore = await get('balanceOf(address)', addr32(B));
check('unobserved address cannot burn', reverted(await call(C === C ? '0x5555555555555555555555555555555555555555' : C, sel('burn(uint256)') + u32(1n))));
await call(B, sel('burn(uint256)') + u32(500n));
check('burn reduces totalMeasured', await get('totalMeasured()') === tmBefore - 500n);
check('burn debits the burner', await get('balanceOf(address)', addr32(B)) === bBalBefore - 500n);
check('burn does not refill the reserve', await get('reserve()') === reserveBefore);
check('burn past balance reverts', reverted(await call(B, sel('burn(uint256)') + u32(10n ** 40n))));
check('burned counter tracks it', await get('burned()') === 500n);
check('accounting holds after burn', await invariant());
check('no mint selector', reverted(await call(A, sel('mint(address,uint256)') + addr32(A) + u32(1n))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
