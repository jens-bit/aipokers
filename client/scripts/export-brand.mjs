// Board 41 assets rendered from the same component as the app. No raster redraw.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {transform} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from '@playwright/test';
const client=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(client,'package.json'));
const compiled=await transform(fs.readFileSync(path.join(client,'src/components/system/RailMark.jsx'),'utf8'),{loader:'jsx',jsx:'automatic',format:'cjs'});
const loaded={exports:{}};
new Function('require','module','exports',compiled.code)(require,loaded,loaded.exports);
const mark=props=>renderToStaticMarkup(React.createElement(loaded.exports.RailMark,props));
const out=path.join(client,'public/brand');fs.mkdirSync(out,{recursive:true});
const svg=(size,bg,radius,inside)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'"><defs><clipPath id="frame"><rect width="'+size+'" height="'+size+'" rx="'+radius+'"/></clipPath></defs><g clip-path="url(#frame)"><rect width="'+size+'" height="'+size+'" fill="'+bg+'"/>'+inside+'</g></svg>';
const favicon=svg(32,'#0B0F0E',6.4,'<g transform="translate(.64 .64)">'+mark({pose:'glyph',size:30.72})+'</g>');
const app=size=>svg(size,'#06322B',size*.225,mark({pose:'icon',size}));
const bot=svg(512,'#0B0F0E',256,'<g transform="translate(-46.08 -51.2)">'+mark({size:604.16})+'</g>');
fs.writeFileSync(path.join(out,'favicon.svg'),favicon);
fs.writeFileSync(path.join(out,'app-icon.svg'),app(512));
fs.writeFileSync(path.join(out,'bot-avatar.svg'),bot);
fs.writeFileSync(path.join(client,'public/railbird.svg'),mark({size:64}));
fs.writeFileSync(path.join(client,'public/railbird-cream.svg'),mark({size:64,color:'#F4EBDD'}));
const browser=await chromium.launch();
try{
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const [name,size,art] of [['favicon-16.png',16,favicon],['favicon-32.png',32,favicon],['app-192.png',192,app(192)],['app-512.png',512,app(512)],['apple-touch-icon.png',180,app(180)],['bot-avatar-512.png',512,bot]]){
    await page.setViewportSize({width:size,height:size});
    await page.setContent('<style>html,body{margin:0;background:transparent}body>svg{width:100vw;height:100vh;display:block}</style>'+art);
    await page.screenshot({path:path.join(out,name),omitBackground:true});
    console.log(name);
  }
}finally{await browser.close();}
