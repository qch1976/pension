@echo off
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
cd /d "C:\Users\Administrator\Desktop\Wechat projects\pension"
node "autotest\gui\phase1-gui-regression.js" ALL > "autotest\output\phase1-gui\all.log" 2>&1
