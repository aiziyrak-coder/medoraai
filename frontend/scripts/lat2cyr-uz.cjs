#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Uzbek Latin -> Cyrillic (explicit 1:1; o', g', ch, sh, ng handled in multi)
const map = {
  a:'а',b:'б',c:'с',d:'д',e:'е',f:'ф',g:'г',h:'ҳ',i:'и',j:'ж',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'қ',r:'р',s:'с',t:'т',u:'у',v:'в',x:'х',y:'й',z:'з',
  A:'А',B:'Б',C:'С',D:'Д',E:'Е',F:'Ф',G:'Г',H:'Ҳ',I:'И',J:'Ж',K:'К',L:'Л',M:'М',N:'Н',O:'О',P:'П',Q:'Қ',R:'Р',S:'С',T:'Т',U:'У',V:'В',X:'Х',Y:'Й',Z:'З'
};

const multi = [
  ["o'", 'ў'], ["O'", 'Ў'], ["g'", 'ғ'], ["G'", 'Ғ'],
  ['ch', 'ч'], ['Ch', 'Ч'], ['CH', 'Ч'], ['sh', 'ш'], ['Sh', 'Ш'], ['SH', 'Ш'],
  ['ng', 'нг'], ['Ng', 'Нг'], ['NG', 'НГ']
];

function lat2cyr(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    let found = false;
    for (const [lat, cyr] of multi) {
      if (s.slice(i, i + lat.length) === lat) {
        out += cyr;
        i += lat.length;
        found = true;
        break;
      }
    }
    if (!found) {
      out += map[s[i]] || s[i];
      i++;
    }
  }
  return out;
}

const src = path.join(__dirname, '../src/i18n/locales/uzL.ts');
const out = path.join(__dirname, '../src/i18n/locales/uzC.ts');
let content = fs.readFileSync(src, 'utf8');

content = content.replace(/export const uzL: TranslationSet = \{/, 'export const uzC: TranslationSet = {');

content = content.replace(/^(\s+)(\w+):\s*'([^']*(?:\\'[^']*)*)'\s*,?\s*$/gm, (_, indent, key, val) => {
  const raw = val.replace(/\\'/g, "'");
  const converted = raw.split(/(\{[^}]+\})/).map((part) => part.startsWith('{') ? part : lat2cyr(part)).join('');
  const escaped = converted.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return indent + key + ": '" + escaped + "',";
});

fs.writeFileSync(out, content, 'utf8');
console.log('Written:', out);
