$Root = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $Root '.runtime\server.pid'
if (-not (Test-Path $PidFile)) { exit 0 }
try {
    $pidValue = [int](Get-Content $PidFile -Raw).Trim()
    $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq 'node') {
        Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
    }
} finally {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
