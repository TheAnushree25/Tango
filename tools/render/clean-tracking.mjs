// Applies the tracking rules to already rendered clips, without rendering them again:
// the ball only counts on the TV camera and while it is safely in shot, and the player while in frame.
import fs from 'node:fs';
import path from 'node:path';
const dir = 'public/tracking';
for (const f of fs.readdirSync(dir)) {
  const file = path.join(dir, f);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const inside = (m) => (e) => e[1] > m && e[1] < 1 - m && e[2] > m && e[2] < 1 - m;
  const player = j.player.filter(inside(0.02));
  const ball = f.includes('_tv') ? j.ball.filter(inside(0.1)) : [];
  fs.writeFileSync(file, JSON.stringify({ player, ball }));
  console.log(f, 'player', player.length, 'ball', ball.length);
}
