' D9: launch Phase-1 GUI regression hidden in the interactive session
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\Administrator\Desktop\Wechat projects\pension"
sh.Run "cmd /c ""C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui\run-phase1-gui.bat""", 0, False
