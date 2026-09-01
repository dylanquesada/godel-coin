const solc = require('solc'), fs = require('fs');
const src = fs.readFileSync('contracts/GodelCoin.sol','utf8');
const out = JSON.parse(solc.compile(JSON.stringify({
  language:'Solidity',
  sources:{'GodelCoin.sol':{content:src}},
  settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}
})));
(out.errors||[]).forEach(e=>console.log(e.formattedMessage));
const c = out.contracts?.['GodelCoin.sol']?.GodelCoin;
if(!c){console.log('COMPILE FAILED');process.exit(1);}
console.log('OK bytecode bytes:', c.evm.bytecode.object.length/2);
fs.writeFileSync('build-abi.json', JSON.stringify(c.abi,null,2));
