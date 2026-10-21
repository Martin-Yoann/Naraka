$ErrorActionPreference = 'Stop'
$shellExecutable = (Get-Process -Id $PID).Path
$nodeExecutable = (Get-Command node.exe).Source
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$collectorScript = Join-Path $PSScriptRoot 'run-collector.ps1'
$serverScript = Join-Path $PSScriptRoot 'run-server.ps1'
foreach ($taskSpec in @(@('ZhexingCollector30m', $collectorScript), @('ZhexingMarketServer', $serverScript))) {
    $existing = Get-ScheduledTask -TaskName $taskSpec[0] -ErrorAction SilentlyContinue
    if ($existing -and $existing.Actions.Arguments -notlike ('*' + $taskSpec[1] + '*')) { throw ('已有同名任务指向其他项目：' + $taskSpec[0]) }
}
$collectorAction = New-ScheduledTaskAction -Execute $shellExecutable -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $collectorScript + '" -NodeExecutable "' + $nodeExecutable + '"')
$collectorTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(30) -RepetitionInterval (New-TimeSpan -Minutes 30)
$collectorSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 8)
Register-ScheduledTask -TaskName 'ZhexingCollector30m' -Action $collectorAction -Trigger $collectorTrigger -Principal $principal -Settings $collectorSettings -Description '永劫无间谪星真实行情，每30分钟采集；不绕过登录或验证' -Force | Out-Null
$serverAction = New-ScheduledTaskAction -Execute $shellExecutable -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $serverScript + '" -NodeExecutable "' + $nodeExecutable + '"')
$serverTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$serverSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'ZhexingMarketServer' -Action $serverAction -Trigger $serverTrigger -Principal $principal -Settings $serverSettings -Description '本机谪星行情台 http://127.0.0.1:3100' -Force | Out-Null
Start-ScheduledTask -TaskName 'ZhexingMarketServer'
Get-ScheduledTask -TaskName 'ZhexingCollector30m','ZhexingMarketServer' | Select-Object TaskName,State
Get-ScheduledTaskInfo -TaskName 'ZhexingCollector30m' | Select-Object NextRunTime
