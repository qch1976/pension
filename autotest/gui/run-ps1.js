const cp=require('child_process');const fs=require('fs');
const out=cp.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',process.argv[2]],{encoding:'utf8'});
fs.writeFileSync(process.argv[3],out,'utf8');process.exit(0);
