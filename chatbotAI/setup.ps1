# Cài đặt Graph RAG Chatbot trên Windows
# Chạy: .\setup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Law Website Graph RAG Setup ===" -ForegroundColor Cyan

# 1. Kiểm tra Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Python chua cai. Tai tu: https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "Nho tick 'Add Python to PATH' khi cai dat."
    exit 1
}
Write-Host "Python: $(python --version)"

# 2. Tao virtual environment
$venvPath = Join-Path $root "python-service\venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "Tao virtual environment..."
    python -m venv $venvPath
}
$pip = Join-Path $venvPath "Scripts\pip.exe"
$pythonVenv = Join-Path $venvPath "Scripts\python.exe"

# 3. Cai dependencies
Write-Host "Cai Python packages..."
& $pip install -r (Join-Path $root "python-service\requirements.txt")

# 4. Copy .env neu chua co
$envFile = Join-Path $root ".env"
$envExample = Join-Path $root ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "Da tao chatbotAI\.env - hay them GEMINI_API_KEY" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Buoc tiep theo:" -ForegroundColor Green
Write-Host "  1. Sua GEMINI_API_KEY trong chatbotAI\.env"
Write-Host "  2a. Khong co Docker: dat USE_NEO4J=false trong .env (da mac dinh)"
Write-Host "  2b. Co Docker: docker compose up -d neo4j"
Write-Host "  3. ingest: python scripts\ingest_datavbpl.py --clear --vector-only"
Write-Host "  4. ..\python-service\venv\Scripts\uvicorn main:app --reload --port 8000"
Write-Host "  5. Them vao backend: USE_GRAPH_RAG=true, AI_SERVICE_URL=http://localhost:8000"
