# Subir cambios a GitHub - Ejecutar cuando termines de trabajar
# Doble clic o: Click derecho -> Ejecutar con PowerShell

Set-Location $PSScriptRoot

Write-Host "=== Subir cambios a GitHub ===" -ForegroundColor Cyan
Write-Host ""

$msg = Read-Host "Mensaje del commit (ej: Agregue dashboard inversores)"
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "Cambios del " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

git add .
git status
Write-Host ""
git commit -m "$msg"
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Subido correctamente." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Revisa el mensaje de error arriba." -ForegroundColor Red
}
Write-Host ""
Read-Host "Presiona Enter para cerrar"
