import * as web3 from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Endereco do programa AMM 3D na Devnet
export const PROGRAM_ID = new web3.PublicKey("4qrMcQxZGoVKqWxA3cvKP8Cin76Zo95KQtChGVMJhdgy");

// Conexao com a Devnet
export const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");

/**
 * Carrega a keypair REAL do disco (mesma usada pela Solana CLI).
 * Padrao: ~/.config/solana/id.json
 * Pode ser sobrescrito com a variavel de ambiente KEYPAIR_PATH.
 *
 * IMPORTANTE: web3.Keypair.generate() cria uma carteira nova e VAZIA
 * a cada execucao. Fora do Solana Playground isso quebra qualquer
 * transacao por falta de saldo. Por isso carregamos do disco aqui.
 */
function loadKeypair(): web3.Keypair {
  const keypairPath =
    process.env.KEYPAIR_PATH || path.join(os.homedir(), ".config", "solana", "id.json");

  if (!fs.existsSync(keypairPath)) {
    throw new Error(
      `Keypair nao encontrada em: ${keypairPath}\n` +
        `Gere uma com:      solana-keygen new --outfile "${keypairPath}"\n` +
        `Financie na devnet: solana airdrop 2 --url devnet`
    );
  }

  const secretKeyString = fs.readFileSync(keypairPath, "utf-8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return web3.Keypair.fromSecretKey(secretKey);
}

export const payer = loadKeypair();
