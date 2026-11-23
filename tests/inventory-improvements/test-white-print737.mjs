import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./architect577.js',import.meta.url),'utf8');
const expression=source.slice(source.indexOf('capture593:async')+'capture593:'.length,source.indexOf(',levels586:'));
for(const fail of [false,true]){
 const background={color:'gray'},fog={color:'gray'},scene={background,fog},camera={aspect:2,updateProjectionMatrix(){}},marker={visible:true};
 let size={x:900,y:450},ratio=1.5;
 const renderer={getSize(){return {...size}},getPixelRatio(){return ratio},setPixelRatio(x){ratio=x},setSize(x,y){size={x,y}},render(){},domElement:{toDataURL(){assert.equal(scene.background.value,'#ffffff');assert.equal(scene.fog,null);if(fail)throw Object.assign(Error('test'),{name:'SecurityError'});return 'data:image/png;base64,test';}}};
 const factory=new Function('I','U','L','M','m','T','J','K','Q','Z','ve','v','H','re','return '+expression);
 const capture=factory(new Map(),false,{traverse(){}},renderer,{Vector2:class{},Color:class{constructor(value){this.value=value}}},camera,marker,null,null,null,null,scene,{camera:{yaw:20},rooms:[{}]},()=>{});
 if(fail)await assert.rejects(capture(),/imagem do ambiente/);else assert.equal((await capture()).rooms,1);
 assert.equal(scene.background,background);assert.equal(scene.fog,fog);assert.equal(marker.visible,true);assert.deepEqual(size,{x:900,y:450});assert.equal(ratio,1.5);assert.equal(camera.aspect,2);
}
console.log('PASS: capture uses white background and no gray fog; interactive scene, camera, overlays and renderer restored on success and failure.');
