# register-gui-task.ps1 (run once, session 0 is fine): interactive task that executes in Administrator's active session
$name = 'PensionGuiRun'
$vbs = 'C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui\gui-hidden.vbs'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $vbs + '"')
$trigger = New-ScheduledTaskTrigger -Once -At ('2026-01-01 00:00')
$principal = New-ScheduledTaskPrincipal -UserId 'Administrator' -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
$t = Get-ScheduledTask -TaskName $name
Write-Output ('REGISTERED ' + $t.TaskName + ' state=' + $t.State)
