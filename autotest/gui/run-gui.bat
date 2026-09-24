@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
"C:\Program Files\nodejs\node.exe" gui-run.js
