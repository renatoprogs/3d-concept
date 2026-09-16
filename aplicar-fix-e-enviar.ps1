# =========================================================
# Script: Aplica correcoes nos client/*.ts e envia (push) o fix
# Repositorio: https://github.com/renatoprogs/3d-concept
# =========================================================

$ProjectPath = "C:\3d concept"
$ClientPath  = Join-Path $ProjectPath "client"

Write-Host "=== 1. Indo para a pasta do projeto ===" -ForegroundColor Cyan
if (-not (Test-Path $ProjectPath)) {
    Write-Host "ERRO: Pasta nao encontrada em '$ProjectPath'" -ForegroundColor Red
    exit
}
Set-Location $ProjectPath
Write-Host "OK: $ProjectPath" -ForegroundColor Green

# --- 2. Verifica se os arquivos corrigidos estao na raiz da pasta do projeto ---
Write-Host ""
Write-Host "=== 2. Localizando arquivos corrigidos ===" -ForegroundColor Cyan
$SourcePath = $ProjectPath

$arquivosCorrigidos = @("config.ts", "client.ts", "auditoria.ts", "gastos.ts", "arbitrage.ts", "arbritage2.ts", "deposit.ts")
$faltando = @()

foreach ($arquivo in $arquivosCorrigidos) {
    $origem = Join-Path $SourcePath $arquivo
    if (-not (Test-Path $origem)) {
        $faltando += $arquivo
    }
}

if ($faltando.Count -gt 0) {
    Write-Host "ATENCAO: os seguintes arquivos nao foram encontrados em '$SourcePath':" -ForegroundColor Yellow
    $faltando | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Salve todos os 7 arquivos corrigidos do chat diretamente em '$SourcePath' e rode o script novamente." -ForegroundColor Yellow
    exit
}

Write-Host "Todos os 7 arquivos encontrados em '$SourcePath'." -ForegroundColor Green

# --- 3. Copia os arquivos para dentro de client/ ---
Write-Host ""
Write-Host "=== 3. Copiando arquivos corrigidos para '$ClientPath' ===" -ForegroundColor Cyan

if (-not (Test-Path $ClientPath)) {
    New-Item -ItemType Directory -Path $ClientPath | Out-Null
}

foreach ($arquivo in $arquivosCorrigidos) {
    $origem = Join-Path $SourcePath $arquivo
    $destino = Join-Path $ClientPath $arquivo
    Copy-Item -Path $origem -Destination $destino -Force
    Write-Host "  Copiado: $arquivo -> client\" -ForegroundColor Green

    # Remove a copia solta na raiz do projeto, ja que o lugar certo e client\
    if ($origem -ne $destino) {
        Remove-Item -Path $origem -Force
    }
}

# --- 4. Verifica se a keypair local existe (necessaria para arbitrage/deposit) ---
Write-Host ""
Write-Host "=== 4. Verificando keypair local da Solana CLI ===" -ForegroundColor Cyan
$KeypairPath = Join-Path $HOME ".config\solana\id.json"

if (-not (Test-Path $KeypairPath)) {
    Write-Host "AVISO: Nenhuma keypair encontrada em '$KeypairPath'" -ForegroundColor Yellow
    Write-Host "Os scripts auditoria.ts e gastos.ts (somente leitura) vao gerar erro ao rodar." -ForegroundColor Yellow
    Write-Host "Para criar uma, rode manualmente (requer Solana CLI instalada):" -ForegroundColor Yellow
    Write-Host "  solana-keygen new --outfile `"$KeypairPath`"" -ForegroundColor Yellow
    Write-Host "  solana airdrop 2 --url devnet" -ForegroundColor Yellow
}
else {
    Write-Host "Keypair encontrada: $KeypairPath" -ForegroundColor Green
}

# --- 5. Commit e push do fix ---
Write-Host ""
Write-Host "=== 5. Commit e push das correcoes ===" -ForegroundColor Cyan

git add .
$statusVazio = git status --porcelain
if ([string]::IsNullOrWhiteSpace($statusVazio)) {
    Write-Host "Nada para commitar (arquivos ja estao iguais ao ultimo commit)." -ForegroundColor Yellow
}
else {
    git commit -m "fix: remove self-reference bug e usa keypair persistente via config.ts"
    git push

    Write-Host ""
    Write-Host "=== Concluido! Verifique em: https://github.com/renatoprogs/3d-concept ===" -ForegroundColor Green
}
