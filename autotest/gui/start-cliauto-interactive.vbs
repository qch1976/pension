' start persistent cli auto in interactive session (hidden), window stays alive
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\Administrator\Desktop\Wechat projects\pension"
sh.Run "cmd /c ""C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui\start-cliauto-interactive.bat""", 0, False
