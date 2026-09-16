# =========================================================
# Script: Instala Git e envia o projeto para o GitHub
# Repositorio alvo: https://github.com/renatoprogs/3d-concept
# =========================================================

# --- CONFIGURACAO: ajuste este caminho para a pasta do projeto extraido do zip ---
$ProjectPath = "C:\3d concept"

Write-Host "=== 1. Verificando se o Git ja esta instalado ===" -ForegroundColor Cyan
$gitInstalled = Get-Command git -ErrorAction SilentlyContinue

if (-not $gitInstalled) {
    Write-Host "Git nao encontrado. Instalando via winget..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements

    Write-Host ""
    Write-Host "Git instalado. FECHE este PowerShell e abra um NOVO para continuar" -ForegroundColor Red
    Write-Host "(o PATH so e atualizado em uma sessao nova)." -ForegroundColor Red
    exit
}
else {
    Write-Host "Git ja instalado: $(git --version)" -ForegroundColor Green
}

# --- 2. Verifica se a pasta do projeto existe ---
Write-Host ""
Write-Host "=== 2. Verificando pasta do projeto ===" -ForegroundColor Cyan
if (-not (Test-Path $ProjectPath)) {
    Write-Host "ERRO: Pasta nao encontrada em '$ProjectPath'" -ForegroundColor Red
    Write-Host "Edite a variavel `$ProjectPath no topo deste script com o caminho correto." -ForegroundColor Red
    exit
}
Set-Location $ProjectPath
Write-Host "Usando pasta: $ProjectPath" -ForegroundColor Green

# --- 3. Corrige o nome do .gitignore, se necessario ---
Write-Host ""
Write-Host "=== 3. Verificando .gitignore ===" -ForegroundColor Cyan
if ((Test-Path ".\_gitignore") -and (-not (Test-Path ".\.gitignore"))) {
    Rename-Item ".\_gitignore" ".\.gitignore"
    Write-Host "Renomeado _gitignore -> .gitignore" -ForegroundColor Green
}
else {
    Write-Host "OK (ja existe .gitignore ou nao ha _gitignore para renomear)" -ForegroundColor Green
}

# --- 4. Configura identidade do Git (necessario para commit) ---
Write-Host ""
Write-Host "=== 4. Configurando identidade Git (se ainda nao configurada) ===" -ForegroundColor Cyan
$userName = git config --global user.name
$userEmail = git config --global user.email

if (-not $userName) {
    $inputName = Read-Host "Digite seu nome para os commits (ex: Renato)"
    git config --global user.name "$inputName"
}
if (-not $userEmail) {
    $inputEmail = Read-Host "Digite seu e-mail do GitHub"
    git config --global user.email "$inputEmail"
}

# --- 5. Inicializa repositorio e envia ---
Write-Host ""
Write-Host "=== 5. Inicializando repositorio e enviando para o GitHub ===" -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    git init
}

git add .
git commit -m "Initial commit: AMM 3D SWAR - lib.rs + client scripts"
git branch -M main

# Remove remote antigo (caso ja exista) e adiciona o correto
git remote remove origin 2>$null
git remote add origin https://github.com/renatoprogs/3d-concept.git

Write-Host ""
Write-Host "=== 6. Enviando (push) para o GitHub ===" -ForegroundColor Cyan
Write-Host "Se pedir login: use seu usuario do GitHub e, no campo de SENHA," -ForegroundColor Yellow
Write-Host "cole um Personal Access Token (nao a senha da conta)." -ForegroundColor Yellow
Write-Host "Gere um token em: https://github.com/settings/tokens" -ForegroundColor Yellow
Write-Host ""

git push -u origin main

Write-Host ""
Write-Host "=== Concluido! Verifique em: https://github.com/renatoprogs/3d-concept ===" -ForegroundColor Green
