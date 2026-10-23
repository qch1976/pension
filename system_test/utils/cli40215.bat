@echo off
rem PensionCli40215 常驻 automator 口启动器（归位 system_test/utils/）
rem 由计划任务 PensionCli40215 拉起，业务脚本只 connect ws://127.0.0.1:40215
cd /d "C:\Users\Administrator\Desktop\Wechat projects\pension"
set CLI="C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"
set PROJECT="C:\Users\Administrator\Desktop\Wechat projects\pension"
set LOG="C:\Users\Administrator\Desktop\Wechat projects\pension\system_test\utils\logs\cli40215.log"
echo CLI_BEGIN %DATE% %TIME% >> %LOG%
%CLI% auto --project %PROJECT% --auto-port 40215 >> %LOG% 2>&1
echo CLI_END %ERRORLEVEL% >> %LOG%
