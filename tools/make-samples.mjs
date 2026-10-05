// 取り込みを試すためのサンプル明細を samples/ に書き出す（UTF-8 版と Shift_JIS 版）
//   node tools/make-samples.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleCsvText } from '../js/sample.js';
import { todayYmd } from '../js/dates.js';
import { encodeSjis } from '../tests/helpers/sjis.js';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'samples');
mkdirSync(out, { recursive: true });
const text = sampleCsvText(todayYmd());
writeFileSync(join(out, 'sample-card-utf8.csv'), text, 'utf8');
writeFileSync(join(out, 'sample-card-sjis.csv'), encodeSjis(text));
console.log('samples written to', out);
