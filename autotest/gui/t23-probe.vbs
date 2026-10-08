Set sh=CreateObject("WScript.Shell")
sh.CurrentDirectory="C:\Users\Administrator\Desktop\Wechat projects\pension"
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui\t23-probe.ps1""",0,False
