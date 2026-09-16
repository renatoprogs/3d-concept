import { connection, payer } from "./config";

async function auditarGastosCarteira() {
  const walletPubkey = payer.publicKey;

  console.log("🔍 Iniciando Auditoria de Gastos da Carteira...");
  console.log(`Endereço: ${walletPubkey.toBase58()}`);

  // Saldo Atual na Solana Devnet
  const saldoLamports = await connection.getBalance(walletPubkey);
  const saldoSOL = saldoLamports / 1e9;

  // Busca o historico recente de assinaturas
  const assinaturas = await connection.getSignaturesForAddress(walletPubkey, { limit: 50 });

  console.log(`\n💰 Saldo Atual em Carteira: ${saldoSOL.toFixed(6)} SOL`);
  console.log(`📜 Total de Transações Processadas no Bloco: ${assinaturas.length}`);

  let totalGasGastoLamports = 0;

  for (const sig of assinaturas) {
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (tx && tx.meta) {
      totalGasGastoLamports += tx.meta.fee;
    }
  }

  const totalGasGastoSOL = totalGasGastoLamports / 1e9;

  console.log("\n================ AUDITORIA FINAL ================");
  console.log(`⚡ Taxas Totais Pagas (Gas Fee): ${totalGasGastoSOL.toFixed(6)} SOL`);
  console.log(
    `📊 Média de Custo por Transação: ${(totalGasGastoSOL / assinaturas.length).toFixed(6)} SOL`
  );
  console.log("=================================================\n");
}

auditarGastosCarteira();
