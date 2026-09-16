console.log("Iniciando PoC Morton-SWAR 3D...");

// 1. Configuracao de Variaveis
const raioInicial = BigInt(100);
const morton3d = BigInt("0x123456789abc");

// 2. Montagem Bitwise no registrador u64
const shiftBits = BigInt(48);
const bitsSuperiores = raioInicial << shiftBits;
const u64Inicial = bitsSuperiores | morton3d;

// 3. Alocacao compativel via DataView
const dataBuffer = Buffer.alloc(8);
const view = new DataView(dataBuffer.buffer);
view.setBigUint64(0, u64Inicial, true);

console.log(`Registrador u64 montado com sucesso: ${u64Inicial.toString()}`);
