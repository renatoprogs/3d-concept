import { Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { connection, payer, PROGRAM_ID } from "./config";

// Mint do USDC na Devnet
const MINT_USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const POOL_ACCOUNT = new PublicKey("4cxharCi1zhQecSq89REnC2hoAJ2DRXrCFXvcqN8UsPE");

async function depositarNaPool3D(quantidadeTokens: number) {
  console.log(`Iniciando depósito de ${quantidadeTokens} USDC na Pool 3D...`);

  // 1. Obter ATA do Usuário e da Pool
  const userTokenAccount = await getAssociatedTokenAddress(MINT_USDC, payer.publicKey);
  const poolTokenAccount = await getAssociatedTokenAddress(MINT_USDC, POOL_ACCOUNT, true);

  const transaction = new Transaction();

  // 2. Garante que a ATA do usuario existe
  const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!userAccountInfo) {
    console.log("Criando conta de USDC para o usuário...");
    transaction.add(
      createAssociatedTokenAccountInstruction(payer.publicKey, userTokenAccount, payer.publicKey, MINT_USDC)
    );
  }

  // 3. Garante que a ATA da pool existe
  const poolAccountInfo = await connection.getAccountInfo(poolTokenAccount);
  if (!poolAccountInfo) {
    console.log("Cofre da Pool não encontrado. Adicionando instrução de criação...");
    transaction.add(
      createAssociatedTokenAccountInstruction(payer.publicKey, poolTokenAccount, POOL_ACCOUNT, MINT_USDC)
    );
  }

  // 4. Instrucao SPL de transferencia de tokens (1 USDC = 1_000_000 unidades minimas)
  const valorComDecimais = BigInt(quantidadeTokens * 1_000_000);

  transaction.add(
    createTransferInstruction(userTokenAccount, poolTokenAccount, payer.publicKey, valorComDecimais, [], TOKEN_PROGRAM_ID)
  );

  // 5. Atualizacao no contrato 3D usando Uint8Array puro
  const bufferInstrucao = new Uint8Array(2);
  const view = new DataView(bufferInstrucao.buffer);
  view.setUint16(0, quantidadeTokens, true);

  transaction.add(
    new TransactionInstruction({
      keys: [{ pubkey: POOL_ACCOUNT, isSigner: false, isWritable: true }],
      programId: PROGRAM_ID,
      data: Buffer.from(bufferInstrucao),
    })
  );

  console.log("Enviando transação para a Devnet...");
  const txHash = await sendAndConfirmTransaction(connection, transaction, [payer]);

  console.log(`Depósito de ${quantidadeTokens} USDC realizado com sucesso! Tx:`, txHash);
}

depositarNaPool3D(1);
