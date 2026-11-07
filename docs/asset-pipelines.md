# Asset pipelines

The finished media is already in `public/`, so you only need these scripts to change it. They have their own dependencies, kept apart from the site's so that a normal install stays small:

```bash
npm run assets:install
```

Run every command from the project root.

## Images and atlases

An atlas holds a colour plate on top, and a strip below it with depth on the left and a matte or class map on the right.

```bash
npm run assets:atlas
```

`tools/atlas/build-atlas.mjs` turns an image into an atlas. It runs BiRefNet (matte) and Depth Anything V2 (depth) locally through ONNX Runtime, then retouches any areas listed in `tools/atlas/patches.json`.

- **Models:** set `MODELS_DIR` to a folder holding `birefnet/model.onnx` and `depth/model.onnx`. It defaults to `tools/atlas/models`.
- **Source images:** these go in `tools/atlas/src`. They aren't committed, because they're large and unretouched. `tools/atlas/gen-flux.mjs` makes new ones from a text prompt. Check the licence of the model you choose before using the images commercially.

## Match clips

The clips come from a procedural 3D match. Start the render server:

```bash
npm run assets:render
```

Then open <http://localhost:8790> and run `R.renderAll()` in the browser console. The plays are defined in `PLAYS` in `tools/render/web/match.js`. Each clip also gets a tracking file for the look-at camera.

## Music and crowd

```bash
npm run assets:audio
```

`tools/audio/synth.mjs` synthesizes the music, crowd beds and interface sounds from scratch. To rebuild just one group, name it: `node tools/audio/synth.mjs goals`. The other groups are `music`, `crowd` and `ui`.

The goal sounds are timed from their own copy of the play data, so keep `PLAYS` in `synth.mjs` in step with `PLAYS` in `match.js`.

## Commentary

Each goal has two takes because the clip loops: the live call plays first, and the replay call plays on the next pass. The site works out which take is due from the clip's position, so the audio file for a goal is twice as long as its clip.

1. Edit the lines and their timing in `tools/audio/commentary/script.mjs`. The `ex` value sets the emotion, from about 0.5 for calm up to 2 for a full shout.

2. Speak any changed lines. The voice is synthetic, made with Chatterbox from the Kokoro clip in `reference.wav`, and it runs locally on the CPU at roughly a minute per line. Unchanged lines are skipped. The first run downloads about 1.5 GB of model files, plus close to 1 GB of libraries in `tools/audio/commentary`. Set `MODELS_DIR` to keep the model somewhere that isn't synced.

   ```bash
   npm run assets:voice
   ```

3. Mix the lines over the crowd. This prints where every line lands and how far it stands above the crowd, and flags any overlaps.

   ```bash
   node tools/audio/synth.mjs goals
   ```
