' gui-hidden.vbs - launch run-gui.bat without a console window (interactive session 2)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui"
sh.Run "cmd /c ""C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui\run-gui.bat""", 0, False
