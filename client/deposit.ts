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
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const connection = connection;
const payer = wallet.keypair;
const programId = PROGRAM_ID;

// Mint do USDC na Devnet
const MINT_USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const POOL_ACCOUNT = new PublicKey("4cxharCi1zhQecSq89REnC2hoAJ2DRXrCFXvcqN8UsPE");

async function depositarNaPool3D(quantidadeTokens: number) {
  console.log(`Iniciando depósito de ${quantidadeTokens} USDC na Pool 3D...`);

  // 1. Obter ATA do Usuário e da Pool
  const userTokenAccount = await getAssociatedTokenAddress(
    MINT_USDC,
    payer.publicKey
  );

  const poolTokenAccount = await getAssociatedTokenAddress(
    MINT_USDC,
    POOL_ACCOUNT,
    true
  );

  const transaction = new Transaction();

  // 2. Garante que a ATA do USUÁRIO existe
  const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!userAccountInfo) {
    console.log("Criando conta de USDC para o usuário...");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userTokenAccount,
        payer.publicKey,
        MINT_USDC
      )
    );
  }

  // 3. Garante que a ATA da POOL existe
  const poolAccountInfo = await connection.getAccountInfo(poolTokenAccount);
  if (!poolAccountInfo) {
    console.log("Cofre da Pool não encontrado. Adicionando instrução de criação...");
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        poolTokenAccount,
        POOL_ACCOUNT,
        MINT_USDC
      )
    );
  }

  // 4. Instrução SPL de Transferência de Tokens (1 USDC = 1_000_000 unidades mínimas)
  const valorComDecimais = BigInt(quantidadeTokens * 1_000_000);
  
  transaction.add(
    createTransferInstruction(
      userTokenAccount,
      poolTokenAccount,
      payer.publicKey,
      valorComDecimais,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 5. Atualização no Seu Contrato 3D usando Uint8Array puro
  const bufferInstrucao = new Uint8Array(2);
  const view = new DataView(bufferInstrucao.buffer);
  view.setUint16(0, quantidadeTokens, true);

  transaction.add(
    new TransactionInstruction({
      keys: [{ pubkey: POOL_ACCOUNT, isSigner: false, isWritable: true }],
      programId: programId,
      data: Buffer.from(bufferInstrucao),
    })
  );

  console.log("Enviando transação para a Devnet...");
  const txHash = await sendAndConfirmTransaction(connection, transaction, [payer]);

  console.log("Depósito de 1 USDC realizado com sucesso! Tx:", txHash);
}

// Alterado de 500 para 1 USDC
depositarNaPool3D(1);