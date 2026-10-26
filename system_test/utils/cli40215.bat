@echo off
REM cli40215.bat (task-72/73) - thin wrapper, all logic in cli40215-keeper.ps1 -> cli40215-keeper.js
REM 常驻口 40215 独立 keeper 入口（system_test/utils/）。NOTE: PensionGuiRun 计划任务 Action 已恢复
REM 为 PLAYBOOK 原始设计（wscript gui-hidden.vbs 投递 GUI 测试脚本）；本 bat 是独立的 40215 拉起入口，
REM 由 IDE 手动启动加载 pension（60964 LISTEN）后手动/自动调用（keeper.js 内含 60964 预检，IDE 未就绪不强跑）。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cli40215-keeper.ps1"
exit /b %ERRORLEVEL%
