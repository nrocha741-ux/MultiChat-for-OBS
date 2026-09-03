param([switch]$DebugMode)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {}

$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root 'app'
$RuntimeDir = Join-Path $Root 'runtime'
$StateDir = Join-Path $Root '.runtime'
$LogsDir = Join-Path $Root 'logs'
$NodeExe = Join-Path $RuntimeDir 'node.exe'
$NpmCmd = Join-Path $RuntimeDir 'npm.cmd'
$PidFile = Join-Path $StateDir 'server.pid'
$InstallStamp = Join-Path $StateDir 'dependencies.version'
$DockUrl = 'http://127.0.0.1:8787/dock'
$HealthUrl = 'http://127.0.0.1:8787/health'
$NodeVersion = '24.20.0'
$MutexName = 'Local\MultiChatForOBS_Portable_Launcher_v2'
$LauncherVersion = '1.0.0'

New-Item -ItemType Directory -Force -Path $RuntimeDir,$StateDir,$LogsDir | Out-Null

function Write-Banner {
    Clear-Host
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host ('              MultiChat for OBS v{0}' -f $LauncherVersion) -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host ''
}

function Write-Step([int]$Current, [int]$Total, [string]$Text) {
    Write-Host (('[{0}/{1}] ' -f $Current,$Total)) -NoNewline -ForegroundColor Cyan
    Write-Host $Text
}

function Write-Ok([string]$Text) {
    Write-Host '      [OK] ' -NoNewline -ForegroundColor Green
    Write-Host $Text
}

function Write-Warn([string]$Text) {
    Write-Host '      [!] ' -NoNewline -ForegroundColor Yellow
    Write-Host $Text
}

function Format-Bytes([long]$Bytes) {
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

function Write-LinearProgress([string]$Label, [long]$Done, [long]$Total) {
    if ($Total -le 0) {
        Write-Host ("`r      $Label... " + (Format-Bytes $Done)) -NoNewline
        return
    }
    $pct = [Math]::Min(100, [Math]::Max(0, [int](($Done * 100.0) / $Total)))
    $width = 34
    $filled = [int][Math]::Floor(($pct / 100.0) * $width)
    $bar = ('#' * $filled) + ('.' * ($width - $filled))
    $status = "`r      {0} [{1}] {2,3}%  {3} / {4}" -f $Label,$bar,$pct,(Format-Bytes $Done),(Format-Bytes $Total)
    Write-Host $status -NoNewline
}

function Test-MultiChatHealth {
    try {
        $r = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
        return ($r.ok -eq $true -and $r.name -eq 'MultiChat for OBS')
    } catch { return $false }
}

function Download-FileWithProgress([string]$Url, [string]$Destination) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.UserAgent = 'MultiChat-for-OBS-Portable-Launcher/1.0.0'
    $response = $request.GetResponse()
    try {
        $total = [long]$response.ContentLength
        $input = $response.GetResponseStream()
        $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try {
            $buffer = New-Object byte[] (1024 * 1024)
            [long]$done = 0
            $lastTick = [Environment]::TickCount
            while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $output.Write($buffer, 0, $read)
                $done += $read
                $now = [Environment]::TickCount
                if (($now - $lastTick) -ge 100 -or ($total -gt 0 -and $done -ge $total)) {
                    Write-LinearProgress 'Download' $done $total
                    $lastTick = $now
                }
            }
            Write-LinearProgress 'Download' $done $total
            Write-Host ''
        } finally {
            if ($output) { $output.Dispose() }
            if ($input) { $input.Dispose() }
        }
    } finally {
        if ($response) { $response.Close() }
    }
}

function Expand-ZipWithProgress([string]$ZipPath, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $entries = @($zip.Entries)
        $totalFiles = @($entries | Where-Object { -not [string]::IsNullOrEmpty($_.Name) }).Count
        $doneFiles = 0
        foreach ($entry in $entries) {
            $target = Join-Path $Destination $entry.FullName
            $fullTarget = [System.IO.Path]::GetFullPath($target)
            $fullRoot = [System.IO.Path]::GetFullPath($Destination + [System.IO.Path]::DirectorySeparatorChar)
            if (-not $fullTarget.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw 'Arquivo ZIP contém um caminho inválido.'
            }
            if ([string]::IsNullOrEmpty($entry.Name)) {
                New-Item -ItemType Directory -Force -Path $fullTarget | Out-Null
                continue
            }
            $parent = Split-Path -Parent $fullTarget
            if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $fullTarget, $true)
            $doneFiles++
            $pct = if ($totalFiles -gt 0) { [int](($doneFiles * 100.0) / $totalFiles) } else { 100 }
            $width = 34
            $filled = [int][Math]::Floor(($pct / 100.0) * $width)
            $bar = ('#' * $filled) + ('.' * ($width - $filled))
            Write-Host ("`r      Extração [{0}] {1,3}%  {2}/{3} arquivos" -f $bar,$pct,$doneFiles,$totalFiles) -NoNewline
        }
        Write-Host ''
    } finally {
        if ($zip) { $zip.Dispose() }
    }
}

function Ensure-PortableNode {
    if (Test-Path $NodeExe) {
        Write-Ok "Node.js portátil encontrado: $(& $NodeExe --version 2>$null)"
        return
    }

    $arch = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
    $nodeArch = if ($arch -match 'ARM64') { 'arm64' } else { 'x64' }
    $zipName = "node-v$NodeVersion-win-$nodeArch.zip"
    $url = "https://nodejs.org/dist/v$NodeVersion/$zipName"
    $downloadPath = Join-Path $StateDir ("node-download-$PID.zip")
    $extractDir = Join-Path $StateDir ("node-extract-$PID")

    Write-Host "      Node.js portátil não encontrado."
    Write-Host "      Baixando Node.js $NodeVersion ($nodeArch) do site oficial..."
    try {
        Download-FileWithProgress $url $downloadPath
        Write-Ok 'Download concluído.'
        Write-Host '      Extraindo o runtime portátil...'
        Expand-ZipWithProgress $downloadPath $extractDir
        Write-Ok 'Extração concluída.'

        $inner = Get-ChildItem $extractDir -Directory | Select-Object -First 1
        if (-not $inner) { throw 'Não foi possível localizar a pasta extraída do Node.js.' }
        Remove-Item (Join-Path $RuntimeDir '*') -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item (Join-Path $inner.FullName '*') $RuntimeDir -Recurse -Force
    } finally {
        Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    if (-not (Test-Path $NodeExe)) { throw 'node.exe não foi encontrado após preparar o runtime portátil.' }
    Write-Ok "Node.js portátil preparado: $(& $NodeExe --version 2>$null)"
}

function Ensure-Dependencies {
    $package = Get-Content (Join-Path $AppDir 'package.json') -Raw | ConvertFrom-Json
    $version = [string]$package.version
    $installed = if (Test-Path $InstallStamp) { (Get-Content $InstallStamp -Raw).Trim() } else { '' }
    $modules = Join-Path $AppDir 'node_modules'
    if ((Test-Path $modules) -and $installed -eq $version) {
        Write-Ok "Dependências do MultiChat v$version encontradas."
        return
    }

    Write-Host '      Instalando dependências necessárias...'
    Write-Host '      O npm não fornece um percentual real confiável; o progresso será mostrado pelo próprio npm.' -ForegroundColor DarkGray
    Write-Host ''
    Push-Location $AppDir
    try {
        & $NpmCmd install --omit=dev --no-audit --no-fund
        $npmExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($npmExit -ne 0) { throw "npm install terminou com código $npmExit." }
    Set-Content -Path $InstallStamp -Value $version -Encoding ASCII
    Write-Host ''
    Write-Ok 'Dependências preparadas.'
}

function Start-Watchdog([int]$NodePid) {
    $watchdog = Join-Path $PSScriptRoot 'MultiChat-Watchdog.ps1'
    $argLine = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdog`" -LauncherPid $PID -NodePid $NodePid -PidFile `"$PidFile`""
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argLine -WindowStyle Hidden | Out-Null
}

function Start-MultiChatServer {
    $stdout = Join-Path $LogsDir 'server.log'
    $stderr = Join-Path $LogsDir 'server-error.log'
    Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue

    $env:PORT = '8787'
    # O ciclo de vida agora é controlado pelo Console Launcher.
    # Enquanto este CMD estiver aberto, o servidor permanece ativo.
    $env:MULTICHAT_PORTABLE = '0'

    $proc = Start-Process -FilePath $NodeExe -ArgumentList 'server/app.js' -WorkingDirectory $AppDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    Set-Content -Path $PidFile -Value $proc.Id -Encoding ASCII
    Start-Watchdog $proc.Id
    return $proc
}

function Show-Connected([System.Diagnostics.Process]$Process) {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '                 MULTICHAT CONECTADO' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Endereço do Dock:' -ForegroundColor Cyan
    Write-Host $DockUrl -ForegroundColor White
    Write-Host ''
    Write-Host ('Servidor Node.js: PID {0}' -f $Process.Id) -ForegroundColor DarkGray
    Write-Host ''
    Write-Host 'IMPORTANTE:' -ForegroundColor Yellow
    Write-Host 'Mantenha esta janela aberta enquanto estiver usando o MultiChat.'
    Write-Host 'Ao fechar esta janela, a instância do Node.js será encerrada automaticamente.'
    Write-Host ''
    Write-Host 'Para encerrar manualmente também é possível usar MultiChat_STOP.cmd.' -ForegroundColor DarkGray
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
}

Write-Banner

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $MutexName, [ref]$createdNew)
if (-not $createdNew) {
    Write-Warn 'Outra inicialização do MultiChat já está em andamento.'
    Write-Host '      Aguarde a outra janela terminar a preparação.'
    for ($i=0; $i -lt 180; $i++) {
        if (Test-MultiChatHealth) {
            Write-Ok 'A outra instância ficou pronta. Abrindo o Dock...'
            Start-Process $DockUrl
            exit 0
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Host '      O servidor não ficou pronto dentro do tempo esperado.' -ForegroundColor Red
    exit 2
}

try {
    Write-Step 1 5 'Verificando pré-requisitos...'
    if (Test-MultiChatHealth) {
        Write-Ok 'O MultiChat já está em execução em outra janela.'
        Write-Host "      $DockUrl"
        Start-Process $DockUrl
        Write-Warn 'Esta nova janela será fechada porque não controla a instância já existente.'
        Start-Sleep -Seconds 2
        exit 0
    }
    Write-Ok 'Porta local disponível e servidor não iniciado.'
    Write-Host ''

    Write-Step 2 5 'Preparando Node.js portátil...'
    Ensure-PortableNode
    Write-Host ''

    Write-Step 3 5 'Preparando dependências do MultiChat...'
    Ensure-Dependencies
    Write-Host ''

    Write-Step 4 5 'Iniciando servidor local...'
    $proc = Start-MultiChatServer
    Write-Ok "Processo iniciado (PID $($proc.Id))."
    Write-Host ''

    Write-Step 5 5 'Aguardando o MultiChat responder...'
    $ready = $false
    for ($i=0; $i -lt 80; $i++) {
        Start-Sleep -Milliseconds 250
        if ($proc.HasExited) { break }
        if (Test-MultiChatHealth) { $ready = $true; break }
        $dots = '.' * (($i % 3) + 1)
        Write-Host ("`r      Aguardando servidor$dots   ") -NoNewline
    }
    Write-Host ''

    if (-not $ready) {
        if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        throw 'O servidor não respondeu em http://127.0.0.1:8787. Consulte logs\server-error.log.'
    }

    Write-Ok 'Servidor respondeu corretamente.'
    Start-Process $DockUrl
    Show-Connected $proc

    if ($DebugMode) {
        Write-Host 'DEBUG: logs do servidor estão em logs\server.log e logs\server-error.log.' -ForegroundColor DarkGray
        Write-Host ''
    }

    while (-not $proc.HasExited) {
        Start-Sleep -Milliseconds 750
        $proc.Refresh()
    }

    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host ''
    Write-Warn "O servidor MultiChat foi encerrado (código $($proc.ExitCode))."
    if ($proc.ExitCode -ne 0) {
        Write-Host '      Consulte logs\server-error.log para detalhes.' -ForegroundColor Yellow
        exit $proc.ExitCode
    }
    exit 0
}
catch {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host '                 ERRO AO INICIAR MULTICHAT' -ForegroundColor Red
    Write-Host '============================================================' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    Write-Host 'Use MultiChat_DEBUG.cmd ou consulte a pasta logs para diagnóstico.' -ForegroundColor Yellow
    exit 1
}
finally {
    if ($mutex) {
        try { $mutex.ReleaseMutex() } catch {}
        $mutex.Dispose()
    }
}
