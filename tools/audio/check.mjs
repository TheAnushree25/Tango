// Prints duration and loudness for every audio file, and writes a spectrogram of one for inspection.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
for (const f of fs.readdirSync('public/audio').sort()) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', `public/audio/${f}`, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const dur = /Duration: ([\d:.]+)/.exec(r.stderr)?.[1];
  const mean = /mean_volume: ([-\d.]+)/.exec(r.stderr)?.[1];
  const max = /max_volume: ([-\d.]+)/.exec(r.stderr)?.[1];
  console.log(f.padEnd(14), dur, 'mean', mean, 'peak', max);
}
const which = process.argv[2] || 'music_1';
spawnSync(ffmpegPath, ['-hide_banner', '-y', '-i', `public/audio/${which}.mp3`, '-lavfi', 'showspectrumpic=s=900x300:legend=0:scale=log', `tools/audio/spectrum_${which}.png`]);
