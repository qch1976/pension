@echo off
set "NODE_PATH=C:\Users\Administrator\wechat-automation\node_modules"
cd /d "C:\Users\Administrator\Desktop\Wechat projects\pension"
node "system_test\TST-02-GT-4000\gui\phase1-gui-regression.js" ALL > "system_test\output\phase1-gui\all.log" 2>&1
