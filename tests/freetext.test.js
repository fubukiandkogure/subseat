import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFreeText } from '../js/freetext.js';

test('仕様書の例文を、サービスごとの候補に分ける', () => {
  const c = parseFreeText('ChatGPTとClaudeとYouTube、あとAmazonも払ってると思う');
  assert.deepEqual(c.map((x) => x.name), ['ChatGPT', 'Claude', 'YouTube Premium', 'Amazonプライム']);
  assert.ok(c.every((x) => x.amount === null && x.nextDate === null), '金額と日付は未確定のまま');
  assert.equal(c[3].confidence, 'low', '「Amazon」だけではプライムか分からない');
});

test('金額や通貨、年払いが書いてあれば拾う', () => {
  const c = parseFreeText('Netflix 1,590円、Spotifyは980円、Notion $10、Adobe 年額26,136円');
  const by = Object.fromEntries(c.map((x) => [x.name, x]));
  assert.equal(by.Netflix.amount, 1590);
  assert.equal(by.Spotify.amount, 980);
  assert.equal(by.Notion.amount, 10);
  assert.equal(by.Notion.currency, 'USD');
  assert.equal(by.Adobe.cycle, 'year');
  assert.equal(by.Adobe.amount, 26136);
});

test('YouTube Music と YouTube Premium を取り違えない', () => {
  assert.deepEqual(parseFreeText('youtube music').map((x) => x.name), ['YouTube Music']);
  assert.deepEqual(parseFreeText('ユーチューブ').map((x) => x.name), ['YouTube Premium']);
});

test('辞書にない名前も、名前だけの候補にする（ひらがなの言い回しは拾わない）', () => {
  const c = parseFreeText('NetflixとZetaflix、あとたぶんモモンガプラスもやってる');
  assert.deepEqual(c.map((x) => x.name), ['Netflix', 'Zetaflix', 'モモンガプラス']);
  assert.equal(c[1].serviceId, null);
  assert.equal(c[1].confidence, 'low');
});

test('同じサービスを2回書いても1つにする', () => {
  assert.equal(parseFreeText('Netflix、ネットフリックス').length, 1);
});
