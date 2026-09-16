import * as web3 from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
// Manually initialize variables that are automatically defined in Playground
const PROGRAM_ID = new web3.PublicKey("4qrMcQxZGoVKqWxA3cvKP8Cin76Zo95KQtChGVMJhdgy");
const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const wallet = { keypair: web3.Keypair.generate() };


console.log("Iniciando PoC Morton-SWAR 3D...");

// 1. Configuração de Variáveis
const raioInicial = BigInt(100);
const morton3d = BigInt("0x123456789abc");

// 2. Montagem Bitwise no registrador u64
const shiftBits = BigInt(48);
const bitsSuperiores = raioInicial << shiftBits;
const u64Inicial = bitsSuperiores | morton3d;

// 3. Alocação compatível via DataView
const dataBuffer = Buffer.alloc(8);
const view = new DataView(dataBuffer.buffer);
view.setBigUint64(0, u64Inicial, true);

console.log(`Registrador u64 montado com sucesso: ${u64Inicial.toString()}`);