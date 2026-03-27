const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'src');

const fixes = [
  {
    file: path.join(root, 'components', 'ConsiliumView.tsx'),
    replacements: [
      [/\bdeepseek:\s*'[^']*'/, "deepseek: 'D'"],
      [/\bllama:\s*'[^']*'/, "llama: 'L'"],
      [/\bmini:\s*'[^']*'/, "mini: 'Mi'"],
      [/\bgpt4o:\s*'[^']*'/, "gpt4o: 'G'"],
      [/(PROFESSOR_ICONS\[agentId\]\s*\|\|\s*)'[^']*'/, "$1'K'"],
    ],
  },
  {
    file: path.join(root, 'components', 'tools', 'DrugIdentifier.tsx'),
    replacements: [
      [/<span className="text-2xl">[^<]*<\/span>/, '<span className="text-2xl font-bold">i</span>'],
      [/\u0440\u0463[^<]*Ko'rsatmalar/, '<span className="opacity-90">I</span> Ko\'rsatmalar'],
      [/\u0432\u0459[^<]*Kontrendikatsiyalar/, '<span className="opacity-90">!</span> Kontrendikatsiyalar'],
      [/\u0440\u0463[^<]*Yon ta'sirlar/, '<span className="opacity-90">Y</span> Yon ta\'sirlar'],
      [/\u0440\u0463[^<]*Qabul qilish/, '<span className="opacity-90">Q</span> Qabul qilish'],
      [/\u0440\u0463[^<]*O'zbekistonda/, '<span className="opacity-90">UZ</span> O\'zbekistonda'],
      [/\u0440\u0463[^<]*Narx:/, 'Narx:'],
    ],
  },
  {
    file: path.join(root, 'components', 'tools', 'DrugInteractionChecker.tsx'),
    replacements: [
      [/<span className="text-2xl">[^<]*<\/span>/, '<span className="text-2xl font-bold">D</span>'],
    ],
  },
  {
    file: path.join(root, 'components', 'DoctorSupportView.tsx'),
    replacements: [
      [/\u0432\u0459-\s*O'zaro Ta'sirlar/, 'O\'zaro Ta\'sirlar'],
      [/\u0432\u0459\u0408\s*Doktor Yordamchi/, 'Doktor Yordamchi'],
    ],
  },
];

for (const { file, replacements } of fixes) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  for (const [re, repl] of replacements) {
    s = s.replace(re, repl);
  }
  fs.writeFileSync(file, s);
  console.log('Fixed', path.relative(__dirname, file));
}

// Jarvis + Ziyrak: remove mojibake from labels/text (replace with plain text)
const jarvisFiles = [
  path.join(root, 'components', 'jarvis', 'JarvisDashboard.tsx'),
  path.join(root, 'components', 'jarvis', 'JarvisInteractive.tsx'),
  path.join(root, 'components', 'jarvis', 'ConsultationMonitor.tsx'),
];

const removeMojibakeRegex = /[\u0440\u0463\u0432\u0459\u0432\u0402\u0432\u0462\u043f\u0451\u0402\u0432\u0459\u0413][^\s'"]*\s*/g;
for (const file of jarvisFiles) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  s = s.replace(removeMojibakeRegex, '');
  s = s.replace(/\u0432-\u0402/g, '');
  s = s.replace(/\u0432\u2116\u0401\u043f\u0451\u0402/g, '');
  s = s.replace(/\u0413-/g, 'x');
  if (s !== before) {
    fs.writeFileSync(file, s);
    console.log('Fixed', path.relative(__dirname, file));
  }
}

console.log('Done.');
