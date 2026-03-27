const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  const list = fs.readdirSync(dir);
  list.forEach((f) => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory() && !f.startsWith('.') && f !== 'node_modules') {
      walk(full, cb);
    } else if (/\.(ts|tsx|js|jsx|json)$/.test(f)) {
      cb(full);
    }
  });
}

let total = 0;
walk('src', (file) => {
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  // Mojibake: UTF-8 en-dash decoded as Windows-1252 -> " - "
  s = s.replace(/\u0432\u0402["\u201C\u201D]/g, ' - ');
  // Mojibake: apostrophe/quote (wrong encoding) -> '
  s = s.replace(/\u0432\u0402[\u2018\u2019\u2122\u0098]/g, "'");
  // Real en-dash and em-dash -> plain hyphen
  s = s.replace(/\u2013/g, '-');
  s = s.replace(/\u2014/g, '-');
  if (s !== orig) {
    fs.writeFileSync(file, s);
    total++;
    console.log(file);
  }
});
console.log('Files updated:', total);
