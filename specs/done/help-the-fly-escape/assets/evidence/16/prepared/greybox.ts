import {WorldView,loadHousePart,loadFlyModel} from '/packages/game-renderer/src/index.ts';
import {loadPlacementAssets} from '/apps/web/src/placement-assets.ts';
import candidate from './candidate.json';
import catalog from './catalog.json';
const view=new WorldView(document.querySelector('#world')!,candidate.level.geometry,1);
for(const part of ['wall','floor'] as const){const response=await fetch(`/assets/house/${part}.glb`);const model=await loadHousePart(await response.arrayBuffer(),part);view.setHousePart(part,model.root);}
const response=await fetch('/assets/fly/fly.glb');view.setFlyModel(await loadFlyModel(await response.arrayBuffer()));
await loadPlacementAssets(view,()=>true);
view.setContactRegions([],[],candidate.level.exit);view.setPlacements(candidate.reference,catalog);view.setPose({x:4,y:0,z:2.6,heading:Math.PI/2});view.selectFly(0);view.overview();
document.querySelector('#overview')!.addEventListener('click',()=>view.overview());
document.querySelector('#junction')!.addEventListener('click',()=>view.selectFly(0));
document.querySelector('#poor')!.addEventListener('click',()=>view.setPlacements(candidate.poor,catalog));
document.querySelector('#reference')!.addEventListener('click',()=>view.setPlacements(candidate.reference,catalog));
function draw(){view.render();requestAnimationFrame(draw);}draw();document.body.dataset.ready='true';
