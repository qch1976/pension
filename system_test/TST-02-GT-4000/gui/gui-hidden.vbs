' gui-hidden.vbs - launch run-gui.bat without a console window (interactive session 2)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\Administrator\Desktop\Wechat projects\pension\system_test\TST-02-GT-4000\gui"
sh.Run "cmd /c ""C:\Users\Administrator\Desktop\Wechat projects\pension\system_test\TST-02-GT-4000\gui\run-gui.bat""", 0, False
