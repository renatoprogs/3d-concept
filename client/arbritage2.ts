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
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// 1. ESCOPO GLOBAL E CONFIGURAÇÃO DO SOLPG
const connection: Connection = connection;
const payer = wallet.keypair;
const PROGRAM_ID_3D: PublicKey = PROGRAM_ID;

// Endereço oficial da sua Pool 3D na Devnet
const POOL_3D_ACCOUNT = new PublicKey("HJwjqhGj6L1qP8BTxeicwYTQTQzxjrz51SgynuhLPFwn");

// 2. FUNÇÃO DE ARBITRAGEM COM AUDITORIA E SIMULAÇÃO PRÉVIA
async function executarArbitragem(volumeApostado: number) {
  console.log(`[BOT ARBITRAGEM] Analisando oportunidade para ${volumeApostado} USDC...`);

  const tx = new Transaction();

  // Buffer de 2 bytes para o contrato Rust
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

  // 3. SIMULAÇÃO PRÉVIA (Evita gasto inútil de Gas em caso de erro)
  const simulacao = await connection.simulateTransaction(tx, [payer]);
  if (simulacao.value.err) {
    console.warn("⚠️ [CANCELADO] Simulação falhou on-chain. Transação abortada para poupar SOL.");
    return;
  }

  // Captura o saldo em SOL da Carteira antes da transação
  const saldoSOLAntes = await connection.getBalance(payer.publicKey);

  console.log("[BOT ARBITRAGEM] Disparando transação atômica na Devnet...");

  try {
    const txHash = await sendAndConfirmTransaction(connection, tx, [payer]);
    
    // Captura o saldo em SOL após a confirmação no bloco
    const saldoSOLDepois = await connection.getBalance(payer.publicKey);
    
    // Calcula a taxa exata gasta na execução
    const gasPagoLamports = saldoSOLAntes - saldoSOLDepois;
    const gasPagoSOL = gasPagoLamports / 1e9;

    console.log(`✅ [SUCESSO] Hash: ${txHash}`);
    console.log(`📊 [AUDITORIA] Custo Real de Gas: ${gasPagoSOL.toFixed(6)} SOL (${gasPagoLamports} Lamports)`);
    console.log(`⚡ [CONSUMO] Compute Units Gastas: ${simulacao.value.unitsConsumed} CUs`);
  } catch (error) {
    console.error("❌ [BOT ARBITRAGEM] Falha no envio:", error);
  }
}

// 4. LISTEN REATIVO VIA WEBSOCKET
console.log("\n[BOT REATIVO] Registrando listener de alta velocidade...");

connection.onAccountChange(
  POOL_3D_ACCOUNT,
  async (accountInfo) => {
    const view = new DataView(accountInfo.data.buffer);
    const registro = view.getBigUint64(0, true);
    
    // Extrai o Raio R dos 16 bits superiores (>> 48)
    const raioRAtual = Number(registro >> BigInt(48));

    console.log(`⚡ [EVENTO ON-CHAIN] Alteração detectada no slot! Raio R: ${raioRAtual}`);

    const VOLUME_ARBITRAGEM = 10;

    if (raioRAtual < 40) {
      console.log(`🚀 [OPORTUNIDADE] Raio R reduzido (${raioRAtual}). Injetando liquidez...`);
      await executarArbitragem(VOLUME_ARBITRAGEM);
    } else if (raioRAtual > 100) {
      console.log(`📉 [OPORTUNIDADE] Raio R expandido (${raioRAtual}). Drenando spread...`);
      await executarArbitragem(VOLUME_ARBITRAGEM);
    } else {
      console.log(`⚖️ [EQUILÍBRIO] Pool dentro dos parâmetros ideais.`);
    }
  },
  "confirmed"
);

console.log("[BOT REATIVO] Bot ativo e aguardando eventos na Pool 3D...\n");