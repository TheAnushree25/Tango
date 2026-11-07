import { Howl, Howler } from 'howler';

/**
 * Three layers, all behind one master volume:
 *  - music: a looping playlist that runs for the whole visit
 *  - ambience: the crowd and match sound of the scene on screen, with the commentary on goal clips,
 *    crossfaded on scene change
 *  - interface: hover and click ticks
 *
 * Nothing can play before the ENTER click, because browsers only allow audio after a gesture.
 */
const MASTER = 0.7;
const MUSIC_VOLUME = 0.55;
const AMBIENCE_FADE = 800;
/** How far, in seconds, the match sound may stray from its clip before it is moved back. */
const DRIFT_LIMIT = 0.09;
const TRACKS = ['/audio/music_1', '/audio/music_2', '/audio/music_3'];

class AudioDirector {
  private music: Howl | null = null;
  private musicLevel = MUSIC_VOLUME;
  private trackIndex = 0;
  private ambience: Howl | null = null;
  private ambienceLoaded: string | undefined;
  private ambienceSrc: string | undefined;
  private ambienceVolume = 1;
  private hover: Howl | null = null;
  private bar: Howl | null = null;
  /** Music and ambience are running (false on the text pages, and while muted). */
  private playing = false;
  /** ENTER has been pressed, so the interface sounds may play. */
  private unlocked = false;
  /** The user switched the sound off with the ON / OFF button. */
  muted = false;
  private lastHover = 0;
  /** Reads the running clip: null when no clip is running by itself. */
  clipSource: (() => { time: number; length: number } | null) | null = null;
  /** Which pass of the clip this is. A goal sound holds one take per pass: the live call, then the replay. */
  private pass = 0;
  private lastClipTime = 0;

  init() {
    if (this.hover) return;
    Howler.volume(MASTER);
    this.hover = new Howl({ src: ['/audio/hover.mp3'], volume: 0.15, preload: true });
    this.bar = new Howl({ src: ['/audio/bar.mp3'], volume: 0.2, preload: true });
    setInterval(() => this.followClip(), 250);
  }

  private playTrack(index: number) {
    this.trackIndex = index % TRACKS.length;
    const howl = new Howl({
      src: [`${TRACKS[this.trackIndex]}.mp3`],
      html5: true,
      volume: 0,
      onend: () => {
        const prev = this.music;
        this.playTrack(this.trackIndex + 1);
        prev?.unload();
      },
      onloaderror: () => {},
    });
    this.music = howl;
    howl.play();
    howl.fade(0, this.musicLevel, 1500);
  }

  /** Safe to call repeatedly: whatever is already running keeps running. */
  start() {
    this.init();
    this.unlocked = true;
    this.playing = true;
    if (!this.music) {
      this.playTrack(0);
    } else if (!this.music.playing()) {
      this.music.play();
      this.music.fade(this.music.volume() as number, this.musicLevel, 600);
    }
    if (!this.ambienceSrc) return;
    if (this.ambience && this.ambienceLoaded === this.ambienceSrc) {
      // Still loading: it starts itself when it arrives.
      if (this.ambience.state() !== 'loaded') return;
      this.alignToClip(this.ambience);
      if (!this.ambience.playing()) this.ambience.play();
      const level = this.ambience.volume() as number;
      if (level !== this.ambienceVolume) this.ambience.fade(level, this.ambienceVolume, 400);
    } else {
      this.startAmbience(this.ambienceSrc, this.ambienceVolume);
    }
  }

  pause() {
    this.playing = false;
    this.music?.pause();
    const a = this.ambience;
    if (!a) return;
    a.fade(a.volume() as number, 0, 300);
    setTimeout(() => {
      if (!this.playing) a.pause();
    }, 320);
  }

  private fadeOutAmbience() {
    const old = this.ambience;
    if (!old) return;
    old.fade(old.volume() as number, 0, AMBIENCE_FADE);
    setTimeout(() => old.unload(), AMBIENCE_FADE + 60);
    this.ambience = null;
    this.ambienceLoaded = undefined;
  }

  private startAmbience(src: string, volume: number) {
    this.fadeOutAmbience();
    this.pass = 0;
    this.lastClipTime = 0;
    const howl = new Howl({
      src: [`${src}.mp3`],
      loop: true,
      volume: 0,
      onloaderror: () => {},
      onload: () => {
        if (this.ambience !== howl || !this.playing) return;
        // Position it first: Howler ends a running fade the moment the position changes.
        this.alignToClip(howl);
        howl.play();
        howl.fade(0, volume, AMBIENCE_FADE);
      },
    });
    this.ambience = howl;
    this.ambienceLoaded = src;
  }

  setAmbience(src: string | undefined, volume = 1, musicVolume = MUSIC_VOLUME) {
    if (musicVolume !== this.musicLevel) {
      this.musicLevel = musicVolume;
      if (this.playing && this.music) this.music.fade(this.music.volume() as number, musicVolume, AMBIENCE_FADE);
    }
    if (src === this.ambienceSrc && volume === this.ambienceVolume) return;
    this.ambienceSrc = src;
    this.ambienceVolume = volume;
    if (!this.playing) return;
    if (src) this.startAmbience(src, volume);
    else this.fadeOutAmbience();
  }

  /** The goal sounds are timed to their clips, so each one sits on its clip's playhead. */
  private alignToClip(howl: Howl) {
    const clip = this.clipSource?.();
    const length = howl.duration();
    if (!clip || !length) return;
    const passes = Math.max(1, Math.round(length / clip.length));
    // The clip jumped back: it looped, changed camera or was scrubbed, so the next take is due.
    if (clip.time < this.lastClipTime - 1) this.pass = (this.pass + 1) % passes;
    this.lastClipTime = clip.time;
    const target = (clip.time + this.pass * clip.length) % length;
    const drift = Math.abs((howl.seek() as number) - target);
    if (Math.min(drift, length - drift) > DRIFT_LIMIT) howl.seek(target);
  }

  /** Catches a clip that started late, looped, was scrubbed, or changed camera. */
  private followClip() {
    const h = this.ambience;
    // Below its target level the sound is still fading, and moving it would end the fade.
    if (h && this.playing && h.playing() && h.volume() === this.ambienceVolume) this.alignToClip(h);
  }

  playHover() {
    if (!this.unlocked || this.muted) return;
    const now = performance.now();
    if (now - this.lastHover < 60) return;
    this.lastHover = now;
    this.hover?.play();
  }

  playBar() {
    if (this.unlocked && !this.muted) this.bar?.play();
  }
}

export const audio = new AudioDirector();
