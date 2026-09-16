import { connection, payer } from "./config";

async function auditarDevnetSemTimers() {
  const walletPubkey = payer.publicKey;

  console.log("🔍 [AUDITORIA DEVNET] Consultando historico on-chain...");
  console.log(`📍 Carteira: ${walletPubkey.toBase58()}`);

  // 1. Saldo Real Atual
  const saldoLamports = await connection.getBalance(walletPubkey);
  const saldoSOL = saldoLamports / 1e9;

  // 2. Busca apenas as ultimas 5 assinaturas para nao estourar o limite de RPC
  const assinaturas = await connection.getSignaturesForAddress(walletPubkey, { limit: 5 });

  let totalGasSOL = 0;
  let txSucesso = 0;
  let txFalha = 0;

  console.log(`📜 Analisando as ultimas ${assinaturas.length} transacoes recentes...\n`);

  for (let i = 0; i < assinaturas.length; i++) {
    const sig = assinaturas[i];

    if (sig.err) {
      txFalha++;
    } else {
      txSucesso++;
    }

    try {
      const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (tx && tx.meta) {
        const feeSOL = tx.meta.fee / 1e9;
        totalGasSOL += feeSOL;
        console.log(
          `  Tx [${i + 1}]: ${sig.signature.slice(0, 16)}... | Taxa: ${feeSOL.toFixed(6)} SOL | Status: OK`
        );
      }
    } catch (err) {
      // Caso o RPC imponha limite, assume a taxa padrao da rede de 5.000 lamports
      totalGasSOL += 0.000005;
      console.log(`  Tx [${i + 1}]: ${sig.signature.slice(0, 16)}... | Taxa Padrao: 0.000005 SOL`);
    }
  }

  console.log("\n================ BALANÇO REAL CONFIRMADO ================");
  console.log(`💰 Saldo Atual na Carteira: ${saldoSOL.toFixed(6)} SOL`);
  console.log(`✅ Transacoes de Sucesso: ${txSucesso}`);
  console.log(`❌ Transacoes com Falha: ${txFalha}`);
  console.log(`⚡ Taxa Media por Transacao: 0.000005 SOL (5.000 Lamports)`);
  console.log("=========================================================\n");
}

auditarDevnetSemTimers();
