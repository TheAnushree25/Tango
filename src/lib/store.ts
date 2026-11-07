import { create } from 'zustand';
import { GOALS, RECORDS, type Goal, type Locale, type RecordItem } from './content';

type UiState = {
  locale: Locale;
  setLocale: (l: Locale) => void;

  /** True once ENTER has been pressed. */
  gateDone: boolean;
  setGateDone: (v: boolean) => void;

  showRecords: boolean;
  setShowRecords: (v: boolean) => void;

  currentGoal: Goal;
  setCurrentGoal: (g: Goal) => void;
  nextGoal: () => void;
  prevGoal: () => void;

  currentRecord: RecordItem;
  setCurrentRecord: (r: RecordItem) => void;
  nextRecord: () => void;
  prevRecord: () => void;

  isAudioPlaying: boolean;
  setAudioPlaying: (v: boolean) => void;

  countersActive: boolean;
  setCountersActive: (v: boolean) => void;

  goalsRevealed: boolean;
  setGoalsRevealed: (v: boolean) => void;

  /** The main ring has scaled up after ENTER: page content may appear. */
  ringReady: boolean;
  setRingReady: (v: boolean) => void;
};

export const useStore = create<UiState>((set, get) => ({
  locale: 'en',
  setLocale: (locale) => {
    set({ locale });
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  },

  gateDone: false,
  setGateDone: (gateDone) => set({ gateDone }),

  showRecords: false,
  setShowRecords: (showRecords) => set({ showRecords }),

  currentGoal: GOALS[0],
  setCurrentGoal: (currentGoal) => set({ currentGoal }),
  nextGoal: () => set({ currentGoal: GOALS[(get().currentGoal.order + 1) % GOALS.length] }),
  prevGoal: () => set({ currentGoal: GOALS[(get().currentGoal.order - 1 + GOALS.length) % GOALS.length] }),

  currentRecord: RECORDS[0],
  setCurrentRecord: (currentRecord) => set({ currentRecord }),
  nextRecord: () => set({ currentRecord: RECORDS[(get().currentRecord.order + 1) % RECORDS.length] }),
  prevRecord: () => set({ currentRecord: RECORDS[(get().currentRecord.order - 1 + RECORDS.length) % RECORDS.length] }),

  isAudioPlaying: true,
  setAudioPlaying: (isAudioPlaying) => set({ isAudioPlaying }),

  countersActive: false,
  setCountersActive: (countersActive) => set({ countersActive }),

  goalsRevealed: false,
  setGoalsRevealed: (goalsRevealed) => set({ goalsRevealed }),

  ringReady: false,
  setRingReady: (ringReady) => set({ ringReady }),
}));
