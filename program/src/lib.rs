use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

// Ponto fixo Q16 para escala Phi de expansão (1.618033... * 65536)
const PHI_EXPANSAO_Q16: u32 = 106_086;

entrypoint!(process_instruction);

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let account = next_account_info(accounts_iter)?;

    // Garante que enviamos ao menos 2 bytes de volume solicitado
    if instruction_data.len() < 2 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut data = account.try_borrow_mut_data()?;
    if data.len() < 8 {
        return Err(ProgramError::AccountDataTooSmall);
    }

    // 1. LEITURA INICIAL: Extrai o u64 da conta e o volume dos dados da instrução
    let mut registro_u64 = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let raio_r_disponivel = (registro_u64 >> 48) as u16;
    let volume_solicitado = u16::from_le_bytes(instruction_data[0..2].try_into().unwrap());

    let novo_raio_r: u16;

    // 2. SENSOR ATÔMICO O(1) & TRATAMENTO DE POOL NOVA (R = 0)
    if raio_r_disponivel == 0 {
        // Pool Nova: O primeiro depósito define o Raio R inicial
        if volume_solicitado == 0 {
            msg!("ERRO ATOMICO: O primeiro deposito deve ser maior que zero!");
            return Err(ProgramError::Custom(2));
        }
        novo_raio_r = volume_solicitado;
        msg!("POOL INICIALIZADA: Raio R inicial definido para {}", novo_raio_r);
    } else {
        // Pool Existente: Valida se há liquidez suficiente no Raio R
        if raio_r_disponivel < volume_solicitado {
            msg!("ERRO ATOMICO: Liquidez Insuficiente no Raio R!");
            return Err(ProgramError::Custom(1));
        }

        // 3. REAJUSTE FRACTAL VIA PHI (Q16 Fixed-Point - Proteção contra Overflow)
        let novo_raio_calculado = (raio_r_disponivel as u64 * PHI_EXPANSAO_Q16 as u64) >> 16;
        
        // Atribui diretamente à variável do escopo superior (sem usar 'let' aqui)
        novo_raio_r = if novo_raio_calculado > u16::MAX as u64 {
            u16::MAX // Trava no limite máximo (65.535) sem estourar o tipo
        } else {
            novo_raio_calculado as u16
        };
    } // Chave de fechamento do bloco else adicionada

    // 4. RE-EMPACOTAMENTO BITWISE: Atualiza o Raio R e preserva o Morton 3D nos 48b inferiores
    registro_u64 = ((novo_raio_r as u64) << 48) | (registro_u64 & 0x0000_FFFF_FFFF_FFFF);

    // Grava de volta no estado da conta em memória
    data[0..8].copy_from_slice(&registro_u64.to_le_bytes());

    msg!("SWAR 3D Sucesso: Raio R atualizado para {}", novo_raio_r);
    Ok(())
}

import {
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

async function testarMersenneOnChain() {
  const connection = pg.connection;
  const payer = pg.wallet.keypair;
  const PROGRAM_ID = pg.PROGRAM_ID;
  const POOL_3D_ACCOUNT = new PublicKey("HJwjqhGj6L1qP8BTxeicwYTQTQzxjrz51SgynuhLPFwn");

  console.log("🚀 Disparando teste de Aritmética M31 no Rust...");

  // Injeta um volume de teste (ex: 25 USDC)
  const volumeIn = 25;
  const buffer = new Uint8Array(2);
  new DataView(buffer.buffer).setUint16(0, volumeIn, true);

  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: POOL_3D_ACCOUNT, isSigner: false, isWritable: true }],
      programId: PROGRAM_ID,
      data: Buffer.from(buffer),
    })
  );

  // Simulação prévia para auditoria de CUs
  const simulacao = await connection.simulateTransaction(tx, [payer]);
  console.log(`📊 [CU AUDIT] Compute Units Gastas no Rust: ${simulacao.value.unitsConsumed} CUs`);

  try {
    const txHash = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log(`✅ [SUCESSO] Hash da Transação: ${txHash}`);
  } catch (err) {
    console.error("❌ Falha na execução:", err);
  }
}

testarMersenneOnChain();

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

// Primo de Mersenne M31 = (2^31) - 1 para computação modular rápida sem divisão em HW
const M31: u64 = (1 << 31) - 1;

#[inline(always)]
fn mersenne_31_reduce(val: u64) -> u64 {
    let mut sum = (val >> 31) + (val & M31);
    if sum >= M31 {
        sum -= M31;
    }
    sum
}

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let pool_account = next_account_info(accounts_iter)?;

    // 1. Decodifica o volume enviado do TypeScript (preserva seu payload atual)
    let volume_in = u16::from_le_bytes(instruction_data[0..2].try_into().unwrap()) as u64;

    // 2. Lê o registrador de 8 bytes nativo (Estatuto SWAR preservado)
    let mut data = pool_account.try_borrow_mut_data()?;
    let registro_atual = u64::from_le_bytes(data[0..8].try_into().unwrap());

    // 3. Extrai componentes (16 bits superiores: Raio R / 48 bits inferiores: Morton 3D)
    let raio_antigo = (registro_atual >> 48) as u64;
    let morton_preservado = registro_atual & ((1u64 << 48) - 1);

    // 4. AGREGANDO MERSENNE: Reajuste modular ultra-rápido para manter o Raio R bounded
    // Em vez do operador de divisão (%), usamos a redução de Mersenne
    let delta = mersenne_31_reduce(raio_antigo + volume_in);
    let novo_raio = (delta % 200) as u16; // Mantém a escala do seu modelo original

    // 5. Reempacota exatamente no mesmo layout u64 de 8 bytes
    let novo_registro = ((novo_raio as u64) << 48) | morton_preservado;
    data[0..8].copy_from_slice(&novo_registro.to_le_bytes());

    msg!("⚡ [SWAR+M31] Raio R: {} -> {}", raio_antigo, novo_raio);

    Ok(())
}
