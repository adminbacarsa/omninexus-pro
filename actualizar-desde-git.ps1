# Actualizar desde GitHub - Ejecutar al empezar a trabajar
# Doble clic o: Click derecho -> Ejecutar con PowerShell

Set-Location $PSScriptRoot

Write-Host "=== Bajando cambios de GitHub ===" -ForegroundColor Cyan
Write-Host ""

git pull origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Actualizado. Ya tenes la ultima version." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Error. ¿Tenés Git instalado? ¿El repo está configurado?" -ForegroundColor Red
    Write-Host "Si es la primera vez, ejecutá configurar-git.ps1" -ForegroundColor Yellow
}
Write-Host ""
Read-Host "Presiona Enter para cerrar"
