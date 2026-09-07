import { chromium } from '/Users/david/dev/fly-escape/node_modules/playwright/index.mjs';
import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5299/');
 const report=await page.evaluate(async()=>{const m=await import('/pkg/fly_contact_query.js');await m.default();const first=m.report();for(let i=0;i<10;i++){if(m.report()!==first)throw Error('Non-repeatable WASM query');}return first;});
 assert.deepEqual(JSON.parse(report),JSON.parse(await readFile('/tmp/fly-contact-query/report.json','utf8')));
 assert.deepEqual(errors,[]);
 await writeFile('/tmp/fly-contact-query/browser.json',JSON.stringify({browser:browser.version(),nativeWasmExactValues:true,repeats:10,errors,report:JSON.parse(report)},null,2));
 console.log('Native/WASM query values identical; ten browser repeats stable.');
}finally{await browser.close();}
