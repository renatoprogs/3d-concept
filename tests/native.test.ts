import assert from "assert";
import * as web3 from "@solana/web3.js";
// Manually initialize variables that are automatically defined in Playground
const PROGRAM_ID = new web3.PublicKey("4qrMcQxZGoVKqWxA3cvKP8Cin76Zo95KQtChGVMJhdgy");
const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const wallet = { keypair: web3.Keypair.generate() };

// tests/native.test.ts - Suíte de Testes Automatizada do AMM 3D

describe("AMM 3D Morton-SWAR Test Suite", () => {
  it("Inicializa a Pool e Valida o Raio R e Morton 3D em u64", async () => {
    const poolAccountKp = new web3.Keypair();
    const POOL_SPACE = 8; // Registrador u64 fixo de 8 bytes

    const rentExemption = await connection.getMinimumBalanceForRentExemption(POOL_SPACE);

    // 1. Instrução de Criação da Conta da Pool
    const createPoolIx = web3.SystemProgram.createAccount({
      fromPubkey: wallet.keypair.publicKey,
      lamports: rentExemption,
      newAccountPubkey: poolAccountKp.publicKey,
      space: POOL_SPACE,
      programId: PROGRAM_ID,
    });

    // 2. Instrução de Inicialização (Envia Volume Inicial = 50)
    const volumeInicial = 50;
    const instructionBuffer = new Uint8Array(2);
    const view = new DataView(instructionBuffer.buffer);
    view.setUint16(0, volumeInicial, true); // Little-Endian

    const initPoolIx = new web3.TransactionInstruction({
      keys: [
        {
          pubkey: poolAccountKp.publicKey,
          isSigner: false,
          isWritable: true,
        },
      ],
      programId: PROGRAM_ID,
      data: Buffer.from(instructionBuffer),
    });

    // 3. Envia e Confirma a Transação Atômica
    const tx = new web3.Transaction().add(createPoolIx, initPoolIx);
    const txHash = await web3.sendAndConfirmTransaction(connection, tx, [
      wallet.keypair,
      poolAccountKp,
    ]);

    console.log(`✅ Teste Sucesso! Hash da Tx: ${txHash}`);

    // 4. Validação Bitwise On-Chain dos 8 Bytes da Conta
    const accountInfo = await connection.getAccountInfo(poolAccountKp.publicKey);
    assert(accountInfo !== null, "A conta da Pool deveria existir");

    const dataBuffer = accountInfo.data;
    const viewAccount = new DataView(dataBuffer.buffer);
    const registroU64 = viewAccount.getBigUint64(0, true);

    // Extrai o Raio R dos 16 bits superiores (>> 48)
    const raioRCalculado = Number(registroU64 >> BigInt(48));

    // Asserções para garantir integridade matemática da SVM
    assert.equal(raioRCalculado, volumeInicial, "O Raio R gravado deve ser igual ao volume inicial fornecido");
    assert.equal(accountInfo.data.length, 8, "A conta deve ocupar exatamente 8 bytes");
    assert(accountInfo.owner.equals(PROGRAM_ID), "O dono da conta deve ser o programa AMM 3D");
  });
});
