//! 3D-Concept AMM PoC - Core Engine
//! Implementação de motor de execução com DOD/SoA e aritmética modular otimizada.

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
// PARÂMETROS DO MOTOR (OFUSCADOS)
// ============================================================================

// Constante de redução modular (M31)
const K_MOD: u64 = 0x7FFFFFFF;

// Máscara de preservação espacial (48 bits inferiores)
const K_MASK: u64 = 0x0000FFFFFFFFFFFF;

// Deslocamento do componente radial (16 bits superiores)
const K_SHIFT: u32 = 48;

// Limite de normalização radial
const K_NORM: u64 = 200;

// ============================================================================
// ROTINAS DE BAIXO NÍVEL
// ============================================================================

#[inline(always)]
fn k_reduce(val: u64) -> u64 {
    let mut s = (val >> 31) + (val & K_MOD);
    if s >= K_MOD { s -= K_MOD; }
    s
}

// ============================================================================
// ENTRYPOINT
// ============================================================================

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let pool_acc = next_account_info(accounts_iter)?;

    if pool_acc.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    if instruction_data.len() < 2 {
        return Err(ProgramError::InvalidInstructionData);
    }

    if pool_acc.data_len() < 8 {
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Decodificação de entrada
    let v_in = u16::from_le_bytes(instruction_data[0..2].try_into().unwrap()) as u64;

    // Leitura do estado SWAR
    let mut data = pool_acc.try_borrow_mut_data()?;
    let reg = u64::from_le_bytes(data[0..8].try_into().unwrap());

    let r_old = (reg >> K_SHIFT) as u64;
    let m_preserved = reg & K_MASK;

    // Lógica de transição de estado
    let r_new: u16 = if r_old == 0 {
        if v_in == 0 { return Err(ProgramError::Custom(1)); }
        (v_in % K_NORM) as u16
    } else {
        if r_old < v_in { return Err(ProgramError::Custom(2)); }
        let sum = r_old + v_in;
        ((k_reduce(sum) % K_NORM) as u16)
    };

    // Escrita atômica do novo estado
    let new_reg = ((r_new as u64) << K_SHIFT) | m_preserved;
    data[0..8].copy_from_slice(&new_reg.to_le_bytes());

    Ok(())
}
