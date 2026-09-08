import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const output = process.env.SELECTION_EVIDENCE ?? '/tmp/fly-selection';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, ...rest) {
        // Pin a final-item fixture independently of campaign inventory tuning.
        const level = message.command?.level;
        const stock = level?.placementRules.inventory.find(item => item.kind === 'dirtyDishes');
        if (stock) stock.count = 1;
        super.postMessage(message, ...rest);
      }
    };
  });
  await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5173');
  await page.getByRole('button',{name:'Dirty dishes 1 left',exact:true}).click();
  let point;
  for(const y of [450,550,650,350]) {
    for(const x of [650,750,550,850,450]) {
      await page.mouse.move(x,y);await page.waitForTimeout(120);
      if(await page.locator('.setup-canvas').getAttribute('data-placement-valid')==='true'){point={x,y};break;}
    }
    if(point)break;
  }
  assert.ok(point);
  await page.screenshot({path:output+'/placing.png'});
  await page.mouse.click(point.x,point.y);
  await page.getByRole('button',{name:'Remove Dirty dishes 1',exact:true}).waitFor();
  assert.equal(await page.locator('.tool-palette [aria-pressed=true]').count(),0);
  assert.equal(await page.locator('.placed-tools [aria-pressed=true]').count(),0);
  await page.mouse.move(point.x+30,point.y+30);
  assert.equal(await page.locator('.setup-canvas').getAttribute('data-placement-valid'),null);
  await page.screenshot({path:output+'/placed.png'});
  await page.getByRole('button',{name:'Release the flies',exact:true}).click();
  await page.waitForSelector('[data-world-state=ready]');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const report=()=>page.getByTestId('playback-report').textContent().then(JSON.parse);
  const unselected=async()=>{
    await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=playback-report]').textContent).camera.selectedFlyId===null);
    assert.equal(await page.locator('.fly-roster [aria-pressed=true]').count(),0);
    assert.equal(await page.getByTestId('selected-fly').count(),0);
    assert.equal((await report()).camera.following,false);
  };
  await unselected();
  const overview=(await report()).camera.distance;
  await page.screenshot({path:output+'/released.png'});
  for(const button of ['left','right']) {
    await page.getByTestId('fly-card-0').click();
    await page.getByTestId('selected-fly').waitFor();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=playback-report]').textContent).camera.following);
    assert.ok((await report()).camera.distance<overview);
    await page.screenshot({path:output+`/selected-${button}.png`});
    await page.mouse.move(500,400);await page.mouse.down({button});
    await page.mouse.move(560,420,{steps:5});await page.mouse.up({button});
    assert.equal(await page.getByTestId('fly-card-0').getAttribute('aria-pressed'),'true','Dragging must not deselect');
    await page.mouse.click(500,400,{button});
    await unselected();
    await page.screenshot({path:output+`/cleared-${button}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('Placement clears the tool; release starts unselected in overview; either click deselects; drags preserve selection.');
} finally {await browser.close();}
