/* poll-wait.js — run over SSH (session 0): wait until job-result.json reaches a terminal state.
 * The GUI job itself runs in session 2; this only reads the file (no model-side polling). */
'use strict';
const fs = require('fs'), path = require('path');
const RESULT = path.join(__dirname, 'job-result.json');
const MAX_MS = parseInt(process.argv[2] || '420000', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < MAX_MS) {
    try {
      const j = JSON.parse(fs.readFileSync(RESULT, 'utf8'));
      if (j.state === 'done' || j.state === 'error' || j.state === 'detached') {
        console.log(JSON.stringify(j));
        process.exit(0);
      }
    } catch (e) { /* not written yet / mid-write */ }
    await sleep(3000);
  }
  console.log('WAIT_TIMEOUT');
  process.exit(2);
})();
