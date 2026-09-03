/**
 * SseBuffer testlari.  Ishga tushirish:  npm run test:sse
 *
 * Asosiy holat: backend butun javobni bitta katta SSE freymi bilan yuboradi,
 * tarmoq esa uni ~8 KB bo'laklarga bo'ladi. Buferlanmasa matn butunlay
 * yo'qolardi (xatoning aynan sababi shu edi).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// sseParser.ts ni joyida kompilyatsiya qilib yuklaymiz (qurish bosqichi shart emas).
const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, 'sseParser.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SseBuffer } = await import(
  'data:text/javascript;base64,' + Buffer.from(js, 'utf8').toString('base64')
);

/** Matnni tarmoq bo'laklariga bo'lish. */
function chunks(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Bo'laklarni buferdan o'tkazib, yig'ilgan matn va done holatini qaytarish. */
function drain(parts) {
  const buf = new SseBuffer();
  let text = '';
  let done = false;
  let error = null;
  for (const part of parts) {
    for (const ev of buf.push(part)) {
      if (ev.chunk) text += ev.chunk;
      if (ev.done) done = true;
      if (ev.error) error = ev.error;
    }
  }
  for (const ev of buf.flush()) {
    if (ev.chunk) text += ev.chunk;
    if (ev.done) done = true;
    if (ev.error) error = ev.error;
  }
  return { text, done, error };
}

test("bitta katta freym tarmoq bo'laklariga bo'linsa ham to'liq yig'iladi", () => {
  const payload = 'A'.repeat(9000);
  const sse = `data: ${JSON.stringify({ chunk: payload })}\n\ndata: [DONE]\n\n`;

  for (const size of [1, 64, 1024, 8192, 16384]) {
    const r = drain(chunks(sse, size));
    assert.equal(r.text.length, payload.length, `bo'lak hajmi ${size}: matn to'liq emas`);
    assert.equal(r.text, payload, `bo'lak hajmi ${size}: matn buzilgan`);
    assert.equal(r.done, true, `bo'lak hajmi ${size}: [DONE] o'tkazib yuborilgan`);
  }
});

test('ketma-ket kelgan kichik bo\'laklar tartibda birlashadi', () => {
  const sse =
    `data: ${JSON.stringify({ chunk: 'Salom ' })}\n\n` +
    `data: ${JSON.stringify({ chunk: 'dunyo' })}\n\n` +
    `data: [DONE]\n\n`;
  const r = drain(chunks(sse, 7));
  assert.equal(r.text, 'Salom dunyo');
  assert.equal(r.done, true);
});

test('server xatosi yutilmaydi', () => {
  const sse = `data: ${JSON.stringify({ error: 'Model javob bermadi' })}\n\ndata: [DONE]\n\n`;
  const r = drain(chunks(sse, 5));
  assert.equal(r.error, 'Model javob bermadi');
});

test("[DONE] siz yopilgan oqim flush() orqali qutqariladi", () => {
  const payload = 'B'.repeat(300);
  const sse = `data: ${JSON.stringify({ chunk: payload })}\n\n`;  // [DONE] yo'q
  const r = drain(chunks(sse, 32));
  assert.equal(r.text, payload);
  assert.equal(r.done, false);
});

test('CRLF chegarasi ham qo\'llab-quvvatlanadi', () => {
  const sse = `data: ${JSON.stringify({ chunk: 'x' })}\r\n\r\ndata: [DONE]\r\n\r\n`;
  const r = drain(chunks(sse, 6));
  assert.equal(r.text, 'x');
  assert.equal(r.done, true);
});
