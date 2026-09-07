import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const bytes = await readFile(new URL('../../assets/food/apple/apple.glb', import.meta.url));
const length = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20,20+length).toString());
const position = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
const offset = 28+length+(gltf.bufferViews[position.bufferView].byteOffset??0)+(position.byteOffset??0);
const changed = Buffer.from(bytes);
changed.writeFloatLE(changed.readFloatLE(offset)+0.0001,offset);
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  for (const mismatch of [false,true]) {
    const page = await browser.newPage();
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    if (mismatch) await page.route('**/*apple.glb*', route=>route.request().resourceType()==='fetch'
      ? route.fulfill({body:changed,contentType:'model/gltf-binary'}) : route.continue());
    await page.goto((process.env.CONTACT_URL??'http://127.0.0.1:5297')+'/?fixture=contact');
    if(mismatch) {

        const began=Date.now();
        while(!errors.length && Date.now()-began<10000) await page.waitForTimeout(50);
        assert.ok(errors.some(error=>error.includes('Apple GLB differs from the core contact fixture')));
      assert.notEqual(await page.locator('#app').getAttribute('data-ready'),'true');
    } else {
      await page.waitForFunction(()=>document.querySelector('#app')?.dataset.ready==='true');
      assert.deepEqual(errors,[]);
    }
    await page.close();
  }
} finally {await browser.close();}
console.log('Native apple accepted; changed position rejected by contact workbench.');
