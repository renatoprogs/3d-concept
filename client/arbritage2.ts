import { Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { connection, payer, PROGRAM_ID } from "./config";

// Endereco oficial da Pool 3D na Devnet
const POOL_3D_ACCOUNT = new PublicKey("HJwjqhGj6L1qP8BTxeicwYTQTQzxjrz51SgynuhLPFwn");

// Trava de reatividade para evitar spam no RPC (erro 429)
let emProcessamento = false;

async function executarArbitragem(volumeApostado: number) {
  console.log(`[BOT ARBITRAGEM] Analisando oportunidade para ${volumeApostado} USDC...`);

  const tx = new Transaction();

  const buffer3D = new Uint8Array(2);
  const view = new DataView(buffer3D.buffer);
  view.setUint16(0, volumeApostado, true);

  tx.add(
    new TransactionInstruction({
      keys: [{ pubkey: POOL_3D_ACCOUNT, isSigner: false, isWritable: true }],
      programId: PROGRAM_ID,
      data: Buffer.from(buffer3D),
    })
  );

  // Simulacao previa (evita gasto inutil de gas em caso de erro)
  const simulacao = await connection.simulateTransaction(tx, [payer]);
  if (simulacao.value.err) {
    console.warn("⚠️ [CANCELADO] Simulação falhou on-chain. Transação abortada para poupar SOL.");
    return;
  }

  const saldoSOLAntes = await connection.getBalance(payer.publicKey);

  console.log("[BOT ARBITRAGEM] Disparando transação atômica na Devnet...");

  try {
    const txHash = await sendAndConfirmTransaction(connection, tx, [payer]);
    const saldoSOLDepois = await connection.getBalance(payer.publicKey);
    const gasPagoLamports = saldoSOLAntes - saldoSOLDepois;
    const gasPagoSOL = gasPagoLamports / 1e9;

    console.log(`✅ [SUCESSO] Hash: ${txHash}`);
    console.log(`📊 [AUDITORIA] Custo Real de Gas: ${gasPagoSOL.toFixed(6)} SOL (${gasPagoLamports} Lamports)`);
    console.log(`⚡ [CONSUMO] Compute Units Gastas: ${simulacao.value.unitsConsumed} CUs`);
  } catch (error) {
    console.error("❌ [BOT ARBITRAGEM] Falha no envio:", error);
  }
}

console.log("\n[BOT REATIVO] Registrando listener de alta velocidade...");

connection.onAccountChange(
  POOL_3D_ACCOUNT,
  async (accountInfo) => {
    if (emProcessamento) return; // ignora disparos em rajada

    const view = new DataView(accountInfo.data.buffer);
    const registro = view.getBigUint64(0, true);
    const raioRAtual = Number(registro >> BigInt(48));

    console.log(`⚡ [EVENTO ON-CHAIN] Alteração detectada no slot! Raio R: ${raioRAtual}`);

    // Ignora estados saturados no teto de 16 bits para nao estourar RPC
    if (raioRAtual >= 65535) {
      console.log("⚠️ Pool saturada no limite máximo (65535). Aguardando reajuste...");
      return;
    }

    const VOLUME_ARBITRAGEM = 10;
    emProcessamento = true;

    try {
      if (raioRAtual < 40) {
        console.log(`🚀 [OPORTUNIDADE] Raio R reduzido (${raioRAtual}). Injetando liquidez...`);
        await executarArbitragem(VOLUME_ARBITRAGEM);
      } else if (raioRAtual > 100) {
        console.log(`📉 [OPORTUNIDADE] Raio R expandido (${raioRAtual}). Drenando spread...`);
        await executarArbitragem(VOLUME_ARBITRAGEM);
      } else {
        console.log("⚖️ [EQUILÍBRIO] Pool dentro dos parâmetros ideais.");
      }
    } finally {
      setTimeout(() => {
        emProcessamento = false;
      }, 500);
    }
  },
  "confirmed"
);

console.log("[BOT REATIVO] Bot ativo e aguardando eventos na Pool 3D...\n");
