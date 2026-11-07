// Batch-generates all dummy portraits of the FICTIONAL player used by the Records scenes.
// Skips files that already exist, so it can be re-run after a quota limit.
// usage: node tools/atlas/batch-images.mjs [schnell|merged|dev|zimage]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'tools/atlas/src';
const PLAYER = 'one fictional male soccer player in his late twenties with short curly black hair, clean shaven';
const LIGHT_KIT = 'wearing a plain white jersey with sky blue vertical stripes';
const DARK_KIT = 'wearing a plain dark navy jersey with a subtle swirling royal blue pattern';
const TAIL = 'solid pure black empty background, dramatic stadium rim lighting, photorealistic sports photography, highly detailed, sharp focus, no text, no logos, no crest';

const jobs = [
  ['hero_b', 91, `Full body sports action photograph of ${PLAYER}, about to strike a soccer ball, three-quarter front view, kicking leg swung back, standing leg planted beside the ball, both arms spread wide for balance, ${LIGHT_KIT}, white shorts, white socks, football boots, the entire figure from head to boots fills the frame height, ${TAIL}`],
  ['rec_0', 201, `Waist-up photograph of ${PLAYER}, celebrating a goal with both arms stretched wide open, mouth open shouting with joy, seen from the front, ${DARK_KIT}, large in frame, ${TAIL}`],
  ['rec_1', 202, `Waist-up photograph of ${PLAYER}, standing with hands on hips, chin raised, looking up at the sky, a gold medal on a ribbon around his neck, ${LIGHT_KIT}, large in frame, ${TAIL}`],
  ['rec_2', 203, `Waist-up photograph of ${PLAYER}, lifting a golden cup trophy high above his head with both hands, joyful expression, ${LIGHT_KIT}, large in frame, ${TAIL}`],
  ['rec_3', 204, `Three-quarter portrait of ${PLAYER}, eyes closed, pointing both index fingers up to the sky, peaceful smile, ${DARK_KIT}, large in frame, ${TAIL}`],
  ['rec_4', 205, `Upper body photograph of ${PLAYER}, running towards the camera, pumping his right fist, intense joyful shout, ${LIGHT_KIT}, large in frame, ${TAIL}`],
  ['rec_5', 206, `Confident waist-up portrait of ${PLAYER}, holding a soccer ball under one arm, looking at the camera with a calm smile, ${DARK_KIT}, large in frame, ${TAIL}`],
  ['rec_6', 207, `Waist-up photograph of ${PLAYER} seen from behind, looking over his shoulder, arms slightly open, the number 10 printed on the back of the shirt, ${LIGHT_KIT}, large in frame, ${TAIL}`],
  ['rec_7', 208, `Waist-up photograph of ${PLAYER}, clapping his hands above his head towards the crowd, proud expression, ${DARK_KIT}, large in frame, ${TAIL}`],
  ['rec_8', 209, `Waist-up photograph of ${PLAYER}, kneeling with both fists raised and head tilted back, emotional roar, ${LIGHT_KIT}, large in frame, ${TAIL}`],
  ['err404', 301, `Full body photograph of ${PLAYER}, sitting alone on a soccer ball, elbows on knees, head down, ${DARK_KIT}, black shorts, ${TAIL}`],
];

const preferred = process.argv[2] || 'schnell';
const order = [preferred, 'schnell', 'merged', 'zimage'].filter((v, i, a) => a.indexOf(v) === i);
let failures = 0;
for (const [name, seed, prompt] of jobs) {
  const out = path.join(dir, `${name}.png`);
  if (fs.existsSync(out)) { console.log('skip', name); continue; }
  let done = false;
  for (const route of order) {
    const r = spawnSync('node', ['tools/atlas/gen-flux.mjs', out, '1344', '768', String(seed), route, prompt], { encoding: 'utf8', timeout: 240000 });
    const line = (r.stdout || '').trim().split('\n').pop();
    console.log(name, route, line);
    if (r.status === 0 && fs.existsSync(out)) { done = true; break; }
  }
  if (!done) failures++;
}
console.log(`finished, ${failures} failed`);
