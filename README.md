# The Last Tempo

A single-screen, cinematic football tribute. Every figure and goal clip is drawn as a cloud of points that you can orbit, scrub with the mouse wheel and push around with the cursor, with live commentary over a crowd and a tango score.

All content is placeholder: the player, teams, scores, records and copy are fictional, and the images, clips and audio were made for this project. The interface and motion are modelled on [thelasttango.com](https://www.thelasttango.com/), but no code, images, footage, music or logos from that site are used here.

## Tech stack

- **Next.js 16** (App Router), **React 19** and **TypeScript**
- **Three.js** for the WebGL stage, with custom GLSL shaders
- **GSAP** with SplitText for the intro and text animation
- **Tailwind CSS v4** for styling tokens and layout
- **Howler** for music, commentary and interface sounds
- **Lenis** for smooth scrolling on the text pages
- **Zustand** for shared interface state

## Getting started

You need Node.js 20.9 or newer. This project was built on Node 22, and `.nvmrc` pins it.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. To run a production build:

```bash
npm run build
npm start
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Builds for production |
| `npm start` | Serves the production build |
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Runs the TypeScript compiler. Run a build first, because it generates `next-env.d.ts` |
| `npm run assets:*` | Regenerates the media. See [docs/asset-pipelines.md](docs/asset-pipelines.md) |

## Project structure

```
.github/workflows/      CI: lint, build and type check on every push
docs/                   Asset pipeline guide
public/                 Finished media, served as-is
  audio/                Music, crowd beds, goal sounds with commentary, interface sounds
  images/ svg/          Flags, emblems and ornaments
  tracking/             Per-clip camera tracking data
  videos/               Goal clips: colour, depth and class map in one video
  webgl/                Image atlases for the point clouds
src/
  app/                  Routes: home, about, legal, 404, plus global styles
  components/
    home/               Goals, records and match statistics
    layout/             App shell, header, entry gate, WebGL stage mount, text pages
    ui/                 Buttons, counters, icons, ring ornaments
  hooks/                Page transitions
  lib/
    webgl/              The stage: point clouds, terrain, dust, cursor field, bloom, camera, scrubbing
    audio.ts            Music, commentary and interface sounds
    content.ts          All visible copy, in English and Spanish
    uiEnter.ts          The opening sequence as one GSAP timeline
tools/                  Scripts that generate the media. Not needed to run or build the site
```

## Changing the content

| What | Where |
|---|---|
| All text, goals and records, in both languages | `src/lib/content.ts` |
| Which image or clip each scene uses, and its framing | `src/lib/webgl/config.ts` |
| Colours, fonts and spacing tokens | `src/app/globals.css` |
| Intro timing | `src/lib/uiEnter.ts` |
| The commentary | `tools/audio/commentary/script.mjs`, then see the [pipeline guide](docs/asset-pipelines.md#commentary) |

## Deployment

The site prerenders to static pages, so it runs on any Node.js host or on Vercel with no environment variables. The goal clips in `public/videos` total about 100 MB, so a CDN is a good idea for real traffic.

Media is cached for a day in production (see `next.config.mjs`). If returning visitors need to hear or see a change straight away, give the changed file a new name.

## Credits

- **Fonts:** Cormorant Garamond, Darker Grotesque and DM Sans, under the SIL Open Font License
- **Commentary voice:** generated with [Chatterbox](https://github.com/resemble-ai/chatterbox) (MIT) from a [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (Apache 2.0) reference clip. It is a synthetic voice, not a real commentator
- **Image analysis:** BiRefNet and Depth Anything V2
- **Generated images:** FLUX, through public Hugging Face demos

## Licence

All rights reserved. See [LICENSE](LICENSE).
