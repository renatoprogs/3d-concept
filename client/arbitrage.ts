import * as web3 from "@solana/web3.js";
// Manually initialize variables that are automatically defined in Playground
const PROGRAM_ID = new web3.PublicKey("4qrMcQxZGoVKqWxA3cvKP8Cin76Zo95KQtChGVMJhdgy");
const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const wallet = { keypair: web3.Keypair.generate() };

import {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const connection = connection;
const payer = wallet.keypair;
const PROGRAM_ID_3D = PROGRAM_ID;

const POOL_3D_ACCOUNT = new PublicKey("HJwjqhGj6L1qP8BTxeicwYTQTQzxjrz51SgynuhLPFwn");

async function executarArbitragem(volumeApostado: number) {
  console.log(`[BOT ARBITRAGEM] Verificando oportunidades para ${volumeApostado} USDC...`);

  const tx = new Transaction();

  // Buffer com os 2 bytes de volume para ajuste de R
  const buffer3D = new Uint8Array(2);
  const view = new DataView(buffer3D.buffer);
  view.setUint16(0, volumeApostado, true);

  tx.add(
    new TransactionInstruction({
      keys: [{ pubkey: POOL_3D_ACCOUNT, isSigner: false, isWritable: true }],
      programId: PROGRAM_ID_3D,
      data: Buffer.from(buffer3D),
    })
  );

  console.log("[BOT ARBITRAGEM] Disparando transação atômica na Devnet...");
  
  try {
    const txHash = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("[BOT ARBITRAGEM] Arbitragem concluída com sucesso! Hash:", txHash);
  } catch (error) {
    console.error("[BOT ARBITRAGEM] Falha no ciclo de arbitragem:", error);
  }
}

executarArbitragem(10);