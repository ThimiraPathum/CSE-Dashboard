[CmdletBinding()]
param(
    [switch]$Setup,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$dashboardUrl = 'http://127.0.0.1:8000'
$pythonPath = $null
$pythonPrefix = @()
$browserJob = $null

try {
    $venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $venvPython) {
        $pythonPath = $venvPython
    }
    elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonPath = (Get-Command py).Source
        $pythonPrefix = @('-3')
    }
    elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonPath = (Get-Command python).Source
    }
    else {
        throw 'Python was not found. Install Python 3.12, then run start-dashboard.cmd -Setup.'
    }

    & $pythonPath @pythonPrefix -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'
    if ($LASTEXITCODE -ne 0) {
        throw 'A working Python 3.10 or newer is required. Python 3.12 is recommended.'
    }

    if ($Setup) {
        if (-not (Test-Path -LiteralPath $venvPython)) {
            Write-Host 'Creating a local Python environment...'
            & $pythonPath @pythonPrefix -m venv (Join-Path $PSScriptRoot '.venv')
            if ($LASTEXITCODE -ne 0) { throw 'Could not create .venv. Check your Python installation.' }
        }
        $pythonPath = $venvPython
        $pythonPrefix = @()
        Write-Host 'Installing dashboard requirements...'
        & $pythonPath -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the output above, then run start-dashboard.cmd -Setup again.' }
    }

    $dependencyCheck = @'
import importlib
import sys
try:
    for name in ('fastapi', 'uvicorn', 'numpy', 'pandas', 'joblib', 'xgboost', 'sklearn', 'multipart'):
        importlib.import_module(name)
except Exception:
    sys.exit(1)
'@
    & $pythonPath @pythonPrefix -c $dependencyCheck
    if ($LASTEXITCODE -ne 0) {
        throw 'Dashboard dependencies are missing. Run start-dashboard.cmd -Setup to install requirements.txt in a local .venv, then try again.'
    }

    $portProbe = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), 8000
    try {
        $portProbe.Start()
    }
    catch {
        throw 'Port 8000 is already in use. Stop the existing service in its terminal, then run start-dashboard.cmd again.'
    }
    finally {
        $portProbe.Stop()
    }

    if (-not $NoBrowser) {
        $browserJob = Start-Job -ArgumentList $dashboardUrl -ScriptBlock {
            param($url)
            for ($attempt = 0; $attempt -lt 90; $attempt++) {
                try {
                    $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2
                    if ($health.app -match 'ceylonquant|alphaiq') {
                        Start-Process $url
                        return
                    }
                }
                catch { }
                Start-Sleep -Milliseconds 500
            }
        }
    }

    Write-Host "Starting CeylonQuant at $dashboardUrl"
    Write-Host 'Keep this window open. Press Ctrl+C to stop the dashboard.'
    & $pythonPath @pythonPrefix -m uvicorn server:app --host 127.0.0.1 --port 8000
    if ($LASTEXITCODE -ne 0) { throw 'The dashboard stopped with an error. Review the output above.' }
}
catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    if ($null -ne $browserJob) {
        Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
}
