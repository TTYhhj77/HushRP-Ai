'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const html=fs.readFileSync('roleplay-ai-prototype-v3.html','utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
const script=scripts.join('\n');
function makeClassList(initial=[]){const values=new Set(initial);return {add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x),toggle(x,force){if(force===undefined)force=!values.has(x);force?values.add(x):values.delete(x);return force}}}
function makeElement({initialClasses=[],children=[]}={}){return {classList:makeClassList(initialClasses),attributes:{},inert:false,children,focusCount:0,addEventListener(){},querySelector(){return this.children[0]||null},setAttribute(name,value){this.attributes[name]=value},focus(){this.focusCount++}}}
test('opening/closing mobile drawer updates accessibility state and traps inert state correctly',()=>{
 const button=makeElement(),drawer=makeElement({children:[makeElement()]}),overlay=makeElement(),body=makeElement();
 const elements={mobileMenuToggle:button,mobileNavDrawer:drawer,mobileNavOverlay:overlay};
 const listeners={};
 const context={document:{body,getElementById:id=>elements[id]||makeElement(),addEventListener:(name,fn)=>listeners[name]=fn,querySelector(){return null},querySelectorAll:()=>[]},innerWidth:390,window:{addEventListener(){},matchMedia:()=>({matches:true}),innerWidth:390},console,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){}},fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})}),URL,Image:function(){},AudioContext:function(){},Float32Array,Math,Date};
 vm.createContext(context);vm.runInContext(script,context);
 context.toggleMobileMenu(true);
 assert.equal(body.classList.contains('mobile-menu-open'),true);assert.equal(button.attributes['aria-expanded'],'true');assert.equal(drawer.inert,false);assert.equal(overlay.attributes['aria-hidden'],'false');assert.equal(drawer.children[0].focusCount,1);
 context.mobileNavigate('create');
 assert.equal(body.classList.contains('mobile-menu-open'),false);assert.equal(button.attributes['aria-expanded'],'false');assert.equal(drawer.inert,true);assert.equal(overlay.attributes['aria-hidden'],'true');assert.equal(button.focusCount,1);
});
test('Escape dismisses the mobile drawer',()=>{
 const button=makeElement(),drawer=makeElement(),overlay=makeElement(),body=makeElement(['mobile-menu-open']);
 const elements={mobileMenuToggle:button,mobileNavDrawer:drawer,mobileNavOverlay:overlay};let keydown;
 const context={document:{body,getElementById:id=>elements[id]||makeElement(),addEventListener:(name,fn)=>{if(name==='keydown')keydown=fn},querySelector(){return null},querySelectorAll:()=>[]},innerWidth:390,window:{addEventListener(){},matchMedia:()=>({matches:true}),innerWidth:390},console,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){}},fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})}),URL,Image:function(){},AudioContext:function(){},Float32Array,Math,Date};
 vm.createContext(context);vm.runInContext(script,context);context.toggleMobileMenu(true);keydown({key:'Escape'});
 assert.equal(body.classList.contains('mobile-menu-open'),false);assert.equal(button.attributes['aria-expanded'],'false');assert.equal(drawer.inert,true);
});
