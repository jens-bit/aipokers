import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';
const publicFile=name=>fileURLToPath(new URL('../public/'+name,import.meta.url));
it('B5/B5b manifest links exported icons at their real PNG dimensions',()=>{
  const manifest=JSON.parse(fs.readFileSync(publicFile('manifest.webmanifest'),'utf8'));
  expect(manifest.name).toBe('Railbird');
  for(const icon of manifest.icons){
    const png=fs.readFileSync(publicFile(icon.src.slice(1)));
    expect(png.subarray(1,4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)+'x'+png.readUInt32BE(20)).toBe(icon.sizes);
  }
  for(const [name,size] of [['favicon-16.png',16],['favicon-32.png',32],['apple-touch-icon.png',180],['bot-avatar-512.png',512]]){
    const png=fs.readFileSync(publicFile('brand/'+name));expect(png.readUInt32BE(16)).toBe(size);expect(png.readUInt32BE(20)).toBe(size);
  }
  expect(fs.readFileSync(publicFile('brand/favicon.svg'),'utf8')).toContain('data-pose="glyph"');
});
