/**
 * The UI (React + GSAP) and the stage (Three.js) never import each other.
 * They talk through a small set of window events, which keeps the render loop free of React.
 */
export const EV = {
  /** Fade the cover point cloud in behind the intro gate. */
  showCover: 'stage:show-cover',
  /** Fade the cover point cloud out when ENTER is pressed. */
  hideCover: 'stage:hide-cover',
  /** detail: goal index */
  changeGoal: 'stage:change-goal',
  /** detail: record index, or null to leave the records scenes */
  changeRecord: 'stage:change-record',
  /** detail: alt-camera index, or null for the main camera */
  changeCamera: 'stage:change-camera',
  /** The stage should appear (after the intro, or when coming back from a text page). */
  fadeInStage: 'stage:fade-in',
  /** Fired by the stage whenever a new scene has faded in. */
  sceneReady: 'stage:scene-ready',
  /** Fired when a new goal has started showing (hooks the counters). */
  goalLoaded: 'stage:goal-loaded',
  /** detail: { stops: string[], labels: string[], active: number | null } */
  camerasChanged: 'stage:cameras-changed',
  playSounds: 'audio:play',
  stopSounds: 'audio:stop',
  enterDone: 'ui:enter-loader-done',
  circleScaled: 'ui:circle-scaled',
  goalsRevealed: 'ui:goals-revealed',
  statsStart: 'ui:stats-start',
} as const;

export const emit = <T,>(name: string, detail?: T) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
};
