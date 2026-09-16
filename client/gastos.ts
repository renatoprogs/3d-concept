import * as web3 from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";// Manually initialize variables that are automatically defined in Playground
const PROGRAM_ID = new web3.PublicKey("4qrMcQxZGoVKqWxA3cvKP8Cin76Zo95KQtChGVMJhdgy");
const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const wallet = { keypair: web3.Keypair.generate() };



async function auditarGastosCarteira() {
  const connection: Connection = connection;
  const walletPubkey: PublicKey = wallet.keypair.publicKey;

  console.log("🔍 Iniciando Auditoria de Gastos da Carteira...");
  console.log(`Endereço: ${walletPubkey.toBase58()}`);

  // Saldo Atual na Solana Devnet
  const saldoLamports = await connection.getBalance(walletPubkey);
  const saldoSOL = saldoLamports / 1e9;

  // Busca o histórico recente de assinaturas
  const assinaturas = await connection.getSignaturesForAddress(walletPubkey, { limit: 50 });

  console.log(`\n💰 Saldo Atual em Carteira: ${saldoSOL.toFixed(6)} SOL`);
  console.log(`📜 Total de Transações Processadas no Bloco: ${assinaturas.length}`);

  let totalGasGastoLamports = 0;

  // Calcula a taxa paga por cada transação assinada por você
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
  console.log(`📊 Média de Custo por Transação: ${(totalGasGastoSOL / assinaturas.length).toFixed(6)} SOL`);
  console.log("=================================================\n");
}

auditarGastosCarteira();