# Khoi dong AI Service (Graph RAG)
# Chay: .\start-ai.ps1
# Lan dau: .\start-ai.ps1 -Setup

param(
    [switch]$Setup,
    [switch]$Ingest
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$svc = Join-Path $root "python-service"
$venvPython = Join-Path $svc "venv\Scripts\python.exe"
$venvPip = Join-Path $svc "venv\Scripts\pip.exe"
$venvUvicorn = Join-Path $svc "venv\Scripts\uvicorn.exe"

function Ensure-Venv {
    if (-not (Test-Path $venvPython)) {
        Write-Host "Tao virtual environment..." -ForegroundColor Yellow
        python -m venv (Join-Path $svc "venv")
        if (-not (Test-Path $venvPython)) {
            Write-Host "Loi: Khong tim thay Python. Cai Python 3.10+ tu python.org (tick Add to PATH)" -ForegroundColor Red
            exit 1
        }
        & $venvPip install -r (Join-Path $svc "requirements.txt")
    }
}

if ($Setup -or -not (Test-Path $venvPython)) {
    Ensure-Venv
    Write-Host "Test Neo4j Aura..." -ForegroundColor Cyan
    & $venvPython (Join-Path $svc "scripts\test_neo4j.py")
}

if ($Ingest) {
    Ensure-Venv
    $dataDir = Join-Path (Split-Path $root -Parent) "datavbpl"
    Write-Host "Nap du lieu: $dataDir" -ForegroundColor Cyan
    if (-not (Test-Path $dataDir)) {
        Write-Host "Loi: Khong thay $dataDir" -ForegroundColor Red
        exit 1
    }
    Set-Location $svc
    & $venvPython scripts\ingest_datavbpl.py --clear
    Set-Location $root
}

Ensure-Venv
Write-Host ""
Write-Host "AI Service: http://localhost:8000" -ForegroundColor Green
Write-Host "Health:     http://localhost:8000/health" -ForegroundColor Green
Write-Host "Dung Ctrl+C de tat" -ForegroundColor Gray
Write-Host ""
Set-Location $svc
& $venvUvicorn main:app --reload --host 0.0.0.0 --port 8000
