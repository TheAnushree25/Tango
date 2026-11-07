// Draws every emblem, ornament and fictional flag as SVG. All of it is original to this project.
// usage: node tools/assets/make-svgs.mjs
import fs from 'node:fs';
import path from 'node:path';

const GOLD = '#D2B55D';
const write = (file, svg) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg.replace(/\n\s*/g, ''));
  console.log(file);
};
const f = (n) => Number(n.toFixed(2));

/* ---------------------------------------------------------------- sun: alternating straight and wavy rays */
function sunRays() {
  const c = 50, n = 32;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const dir = [Math.cos(a), Math.sin(a)];
    const nrm = [-dir[1], dir[0]];
    const p = (r, s) => `${f(c + dir[0] * r + nrm[0] * s)} ${f(c + dir[1] * r + nrm[1] * s)}`;
    if (i % 2 === 0) {
      d += `M${p(25, -2.1)}L${p(49, 0)}L${p(25, 2.1)}Z`;
    } else {
      d += `M${p(25, -1.7)}C${p(31, -3.6)} ${p(34, 2.2)} ${p(39, -0.5)}C${p(41, -1.6)} ${p(42.5, -0.8)} ${p(44.5, 0)}C${p(42.5, 0.9)} ${p(41, 1.6)} ${p(39, 1.3)}C${p(34, 3.8)} ${p(31, -1.2)} ${p(25, 1.7)}Z`;
    }
  }
  return d;
}
write('public/svg/sun.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${sunRays()}" fill="${GOLD}"/></svg>`);

/* ---------------------------------------------------------------- core: a tiny football panel inside a ring */
function ballCore() {
  const c = 50;
  const pent = [];
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    pent.push(`${f(c + Math.cos(a) * 8.5)} ${f(c + Math.sin(a) * 8.5)}`);
    out.push(`M${f(c + Math.cos(a) * 8.5)} ${f(c + Math.sin(a) * 8.5)}L${f(c + Math.cos(a) * 15.5)} ${f(c + Math.sin(a) * 15.5)}`);
  }
  return `<path d="M${pent.join('L')}Z" fill="${GOLD}"/><path d="${out.join('')}" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>`;
}
write('public/svg/core.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="22" fill="#030c1c" stroke="${GOLD}" stroke-width="2.4"/>${ballCore()}</svg>`);
write('public/svg/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#030c1c"/><path d="${sunRays()}" fill="${GOLD}"/><circle cx="50" cy="50" r="22" fill="#030c1c" stroke="${GOLD}" stroke-width="2.4"/>${ballCore()}</svg>`);

/* ---------------------------------------------------------------- the marker inside the active goal dot */
function star(cx, cy, r, inner = 0.42) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)}`;
  }
  return `${d}Z`;
}
write(
  'public/images/dot-cup.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="23" fill="#030c1c" stroke="${GOLD}" stroke-width="1.5"/>
    <path d="M15.5 12H32.5V18.5C32.5 24 29 27.5 24 27.5S15.5 24 15.5 18.5V12Z" fill="#f5f5f5"/>
    <path d="M15.5 14.5H10.5C10.5 19.5 12.6 22.3 16.8 23.2M32.5 14.5H37.5C37.5 19.5 35.4 22.3 31.2 23.2" stroke="#f5f5f5" stroke-width="2" fill="none"/>
    <path d="M24 27V33M16.5 36.5H31.5M19 33.5H29" stroke="#f5f5f5" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${star(24, 18.5, 4.4)}" fill="${GOLD}"/>
  </svg>`,
);

/* ---------------------------------------------------------------- corner flourish */
write(
  'public/images/corners.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 42" fill="none">
    <defs>
      <linearGradient id="a" x1="0" y1="42" x2="88" y2="0" gradientUnits="userSpaceOnUse">
        <stop stop-color="#9fb6e8" stop-opacity=".18"/>
        <stop offset=".35" stop-color="#c6d6f6" stop-opacity=".62"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity=".08"/>
      </linearGradient>
      <linearGradient id="b" x1="30" y1="8" x2="60" y2="34" gradientUnits="userSpaceOnUse">
        <stop stop-color="#f4f7ff" stop-opacity=".78"/>
        <stop offset="1" stop-color="#6f8fda" stop-opacity=".32"/>
      </linearGradient>
    </defs>
    <path d="M1 41.5C3.6 31.3 9.8 19.9 20.4 13.5C30.6 7.4 43.2 7.6 49.6 14.3C54.8 19.7 53.5 27.4 47.5 29.5C42.2 31.3 37 27.6 37.8 22.8C38.4 19.2 42 17.1 45 18.7" stroke="url(#b)" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M2.6 40.2C7 30.5 13.6 22 22.3 17.6C25.9 15.8 29.8 15 33.7 15.2" stroke="url(#a)" stroke-width=".7" stroke-linecap="round"/>
    <path d="M44 9.7C50 5.7 58.3 7 64.5 9.8C70.7 12.6 77.5 12.6 86.5 1.2C81.7 11.6 74.3 16 66.2 14.2C60 12.8 54.7 9.2 49 10.3" fill="url(#a)"/>
    <path d="M56 22.5C61.2 18.2 67.5 18 72.6 20.4C76.2 22.1 79.5 22 83.2 19.6C79.9 24.6 74.8 25.6 70.3 23.8C65.6 21.9 60.8 21 56 22.5Z" fill="url(#a)"/>
    <path d="M18 31.6C21.8 29.4 25.6 30.2 27.4 33.1C24 32.7 21 32.6 18 31.6ZM8.9 26.3C7.5 22.2 8.7 18.4 11.9 16.1C12.4 19.6 11.5 23.2 8.9 26.3Z" fill="url(#a)"/>
    <circle cx="33.6" cy="35.2" r=".9" fill="#dfe8ff" fill-opacity=".5"/>
    <circle cx="38.8" cy="36.4" r=".6" fill="#dfe8ff" fill-opacity=".4"/>
  </svg>`,
);

/* ---------------------------------------------------------------- fictional team flags, as round badges */
const flag = (name, body) =>
  write(
    `public/images/flags/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><clipPath id="c"><circle cx="24" cy="24" r="24"/></clipPath></defs><g clip-path="url(#c)">${body}</g></svg>`,
  );
flag('aur', `<rect width="48" height="48" fill="#f5f5f5"/><rect x="8" width="9" height="48" fill="#65A9E7"/><rect x="31" width="9" height="48" fill="#65A9E7"/><path d="${star(24, 24, 8)}" fill="${GOLD}"/>`);
flag('bor', `<rect width="48" height="48" fill="#0f7f7a"/><path d="M0 48L48 0V48Z" fill="#ee8a2c"/><circle cx="24" cy="24" r="5" fill="#f5f5f5"/>`);
flag('cas', `<rect width="48" height="48" fill="#a51d36"/><rect y="17" width="48" height="14" fill="#f5f5f5"/><path d="${star(24, 24, 6)}" fill="#a51d36"/>`);
flag('del', `<rect width="48" height="48" fill="#132a63"/><rect x="24" width="24" height="48" fill="#a8d42e"/><circle cx="24" cy="24" r="6.5" fill="#f5f5f5"/>`);
flag('esm', `<rect width="48" height="48" fill="#5a2aa3"/><path d="M0 0H48L24 24Z" fill="#e8bc3d"/><path d="M0 48H48L24 24Z" fill="#e8bc3d"/>`);
flag('far', `<rect width="48" height="48" fill="#111"/><path d="M0 0H16V16H0ZM32 0H48V16H32ZM16 16H32V32H16ZM0 32H16V48H0ZM32 32H48V48H32Z" fill="#f5f5f5"/>`);
