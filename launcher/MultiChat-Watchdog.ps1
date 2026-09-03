param(
    [Parameter(Mandatory=$true)][int]$LauncherPid,
    [Parameter(Mandatory=$true)][int]$NodePid,
    [Parameter(Mandatory=$true)][string]$PidFile
)

$ErrorActionPreference = 'SilentlyContinue'

while ($true) {
    $launcher = Get-Process -Id $LauncherPid -ErrorAction SilentlyContinue
    if (-not $launcher) { break }
    Start-Sleep -Milliseconds 500
}

$node = Get-Process -Id $NodePid -ErrorAction SilentlyContinue
if ($node -and $node.ProcessName -eq 'node') {
    Stop-Process -Id $NodePid -Force -ErrorAction SilentlyContinue
}
Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
