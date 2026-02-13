# Script para hacer push a GitHub
# Doble clic o: Click derecho -> Ejecutar con PowerShell

Set-Location $PSScriptRoot

Write-Host "=== Push a adminbacarsa/omninexus-pro ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si aparece ventana de login: usa adminbacarsa y tu token de GitHub" -ForegroundColor Yellow
Write-Host "Token: https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host ""

git push -u origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Push exitoso." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Error. Revisa el mensaje arriba." -ForegroundColor Red
}
Write-Host ""
Read-Host "Presiona Enter para cerrar"
