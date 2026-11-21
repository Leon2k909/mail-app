param(
    [Parameter(Mandatory)] [string] $ElectronExe,
    [string] $NativeExe = (Join-Path $PSScriptRoot 'target/release/mail-preview.exe'),
    [ValidateRange(1, 15)] [int] $Runs = 5
)

$ErrorActionPreference = 'Stop'
$electron = Get-Item -LiteralPath (Resolve-Path -LiteralPath $ElectronExe)
$native = Get-Item -LiteralPath (Resolve-Path -LiteralPath $NativeExe)
$profile = Join-Path $PSScriptRoot ('target/benchmark-' + [guid]::NewGuid().ToString('n'))

function Get-BenchmarkProcesses($executable) {
    Get-Process -Name $executable.BaseName -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -eq $executable.FullName }
}

function Measure-Launch($executable, $arguments, $windowTitle) {
    if (Get-BenchmarkProcesses $executable) {
        throw "Close the app at $($executable.FullName) before benchmarking it."
    }
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process -FilePath $executable.FullName -ArgumentList $arguments -PassThru
    try {
        do {
            Start-Sleep -Milliseconds 10
            $process.Refresh()
            if ($process.HasExited -or $clock.Elapsed.TotalSeconds -gt 15) {
                throw "$($executable.Name) did not show its main window."
            }
        } until ($process.MainWindowHandle -ne 0 -and $process.MainWindowTitle -eq $windowTitle)
        $launchMs = $clock.Elapsed.TotalMilliseconds

        Start-Sleep -Milliseconds 2200
        $appProcesses = @(Get-BenchmarkProcesses $executable)
        $ids = @($appProcesses.Id)
        $counters = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
            Where-Object { [int]$_.IDProcess -in $ids }
        $privateBytes = ($counters | Measure-Object -Property WorkingSetPrivate -Sum).Sum
        if (!$privateBytes) { throw 'Windows did not report a working set for the app.' }
        [pscustomobject]@{
            StartupMs = $launchMs
            PrivateWorkingSetMiB = $privateBytes / 1MB
            Processes = $ids.Count
        }
    } finally {
        Get-BenchmarkProcesses $executable | Stop-Process -ErrorAction SilentlyContinue
        if (!$process.HasExited) { $null = $process.WaitForExit(3000) }
        Start-Sleep -Milliseconds 300
    }
}

function Get-Median($values) {
    $values = @($values | Sort-Object)
    $center = [int][math]::Floor($values.Length / 2)
    if ($values.Length % 2) { return $values[$center] }
    return ($values[$center - 1] + $values[$center]) / 2
}

$electronArgs = @("--user-data-dir=`"$profile`"", '"--host-resolver-rules=MAP * ~NOTFOUND"')
$nativeArgs = @('--empty')
$nativeTitle = 'Mail Preview · Rust / GPUI'
$null = Measure-Launch $electron $electronArgs 'mail'
$null = Measure-Launch $native $nativeArgs $nativeTitle

$electronMeasurements = @()
$nativeMeasurements = @()
foreach ($run in 1..$Runs) {
    $electronMeasurements += Measure-Launch $electron $electronArgs 'mail'
    $nativeMeasurements += Measure-Launch $native $nativeArgs $nativeTitle
}

$electronBytes = (Get-ChildItem -LiteralPath $electron.DirectoryName -Recurse -File |
    Measure-Object -Property Length -Sum).Sum
@(
    @{ App = 'Electron 1.2.0'; Runs = $electronMeasurements; Bytes = $electronBytes },
    @{ App = 'Rust / GPUI'; Runs = $nativeMeasurements; Bytes = $native.Length }
) | ForEach-Object {
    [pscustomobject]@{
        App = $_.App
        MedianLaunchMs = [math]::Round((Get-Median $_.Runs.StartupMs))
        MedianPrivateWorkingSetMiB = [math]::Round((Get-Median $_.Runs.PrivateWorkingSetMiB), 1)
        MedianProcesses = Get-Median $_.Runs.Processes
        UnpackedMiB = [math]::Round($_.Bytes / 1MB, 1)
    }
}
