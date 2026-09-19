//! 3D-Concept AMM PoC - Core Engine (v2.0 Optimized)
//! Implementação com DOD/SoA, Aritmética U128, Double Buffering e Loop Unrolling.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

// ============================================================================
// PARÂMETROS DO MOTOR (OFUSCADOS & CONSTANTES MÁGICAS)
// ============================================================================

// Escala Mersenne Prima (2^61 - 1) para precisão estendida
const K_MERS: u128 = 0x1FFFFFFFFFFFFFFF; 

// Máscara de preservação espacial (48 bits inferiores)
const K_MASK: u128 = 0x0000FFFFFFFFFFFF;

// Deslocamento do componente radial (64 bits superiores para U128)
const K_SHIFT: u32 = 64;

// Limite de normalização radial (Suavização Phi)
const K_NORM: u128 = 200;

// Tamanho do Buffer Unitário (8 bytes)
const BUF_SIZE: usize = 8;

// Offset dos Buffers na Arena (Double Buffering)
const OFF_A: usize = 8;  // Buffer Ativo
const OFF_B: usize = 16; // Buffer Standby
const OFF_IDX: usize = 0; // Indicador de Índice (0=A, 1=B)

// ============================================================================
// ROTINAS DE BAIXO NÍVEL (LOOP UNROLLING & ARITMÉTICA U128)
// ============================================================================

#[inline(always)]
fn k_reduce_unroll(val: u128) -> u128 {
    // Decomposição Mersenne desenrolada para evitar divisão lenta
    // Equivalente a: val % K_MERS usando apenas shifts e adds
    let mut s = (val >> 61) + (val & K_MERS);
    
    // Segunda passagem necessária para valores > 2*MERS
    let hi = s >> 61;
    let lo = s & K_MERS;
    s = hi + lo;
    
    // Normalização final condicional
    if s >= K_MERS { 
        s -= K_MERS; 
    }
    s
}

#[inline(always)]
fn get_active_offset(idx: u8) -> usize {
    // Seleção atômica de buffer sem branches complexos
    if idx == 0 { OFF_A } else { OFF_B }
}

// ============================================================================
// LAYOUT DA CONTA (ARENA CIRCULAR)
// ============================================================================
// [0..8]   : u64 (Índice do Buffer Ativo + Metadados)
// [8..16]  : u64 (Buffer A - Dados Radiais/Morton)
// [16..24] : u64 (Buffer B - Dados Radiais/Morton)
// Requerimento Mínimo: 24 bytes
// ============================================================================

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let pool_acc = next_account_info(accounts_iter)?;

    // Validação de Propriedade e Segurança
    if pool_acc.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    if instruction_data.len() < 2 {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Validação de Tamanho Mínimo para Arena (24 bytes)
    if pool_acc.data_len() < 24 {
        return Err(ProgramError::AccountDataTooSmall);
    }

    let mut data = pool_acc.try_borrow_mut_data()?;

    // Leitura Atômica do Índice do Buffer (Double Buffering)
    let idx_byte = data[OFF_IDX];
    let active_idx = idx_byte & 1; // Garante 0 ou 1
    let off_cur = get_active_offset(active_idx);
    let off_next = get_active_offset(1 - active_idx);

    // Leitura do Estado Atual (U64 armazenado, convertido para U128)
    let reg_bytes: [u8; 8] = data[off_cur..off_cur + BUF_SIZE].try_into().unwrap();
    let reg_old = u64::from_le_bytes(reg_bytes) as u128;

    let r_old = (reg_old >> K_SHIFT) as u128;
    let m_preserved = reg_old & K_MASK;

    // Decodificação de Entrada (U128 para precisão interna)
    let v_in = u16::from_le_bytes(instruction_data[0..2].try_into().unwrap()) as u128;

    // Lógica de Transição de Estado (Motor 3D Conceitual)
    let r_new: u128 = if r_old == 0 {
        // Inicialização com suavização
        if v_in == 0 { return Err(ProgramError::Custom(1)); }
        (v_in % K_NORM)
    } else {
        // Cálculo de Interação (Aceleração/Desaceleração Phi)
        if r_old < v_in { return Err(ProgramError::Custom(2)); }
        
        // Soma em U128 para evitar overflow antes da redução
        let sum = r_old + v_in;
        
        // Aplicação da Redução Mersenne Otimizada
        let reduced = k_reduce_unroll(sum);
        
        (reduced % K_NORM)
    };

    // Construção do Novo Registro
    let new_reg = ((r_new as u64) << K_SHIFT) | (m_preserved as u64);

    // Escrita no Buffer Standby (Preparação Atômica)
    data[off_next..off_next + BUF_SIZE].copy_from_slice(&new_reg.to_le_bytes());

    // Swap Atômico do Índice (Torna o novo buffer visível instantaneamente)
    // Isso evita race conditions onde leitores pegam dados pela metade
    data[OFF_IDX] = 1 - active_idx;

    Ok(())
}
