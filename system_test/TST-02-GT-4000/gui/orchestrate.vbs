Set sh=CreateObject("WScript.Shell")
sh.CurrentDirectory="C:\Users\Administrator\Desktop\Wechat projects\pension"
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\Users\Administrator\Desktop\Wechat projects\pension\system_test\TST-02-GT-4000\gui\phase1-orchestrate.ps1""",0,False
