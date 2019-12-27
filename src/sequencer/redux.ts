import * as R from 'ramda';
import { buildStore, buildActionGroup, buildModule } from 'jantix';
import { UnimplementedError, UnreachableException } from 'ameo-utils';

import { SampleDescriptor } from 'src/sampleLibrary';
import { MIDINode, buildMIDINode } from 'src/patchNetwork/midiNode';

export type VoiceTarget =
  | { type: 'sample'; sampleIx: number | null }
  | { type: 'midi'; synthIx: number | null; note: number };

export type PlayingStatus =
  | { type: 'NOT_PLAYING' }
  | { type: 'PLAYING'; intervalHandle: number; curColIx: number };

export enum SchedulerScheme {
  Stable,
  Swung,
  Random,
}

const getIsPlaying = (playingStatus: PlayingStatus) => playingStatus.type === 'PLAYING';

export interface SequencerReduxState {
  voices: VoiceTarget[];
  sampleBank: { descriptor: SampleDescriptor; buffer: AudioBuffer }[];
  /**
   * For each voice, an array of the indices of all marked cells for that voice/row
   */
  marks: boolean[][];
  bpm: number;
  playingStatus: PlayingStatus;
  outputGainNode: GainNode;
  midiOutputs: MIDINode[];
  schedulerScheme: SchedulerScheme;
}

const ctx = new AudioContext();

const actionGroups = {
  SET_STATE: buildActionGroup({
    actionCreator: (newState: SequencerReduxState) => ({ type: 'SET_STATE', newState }),
    subReducer: (_state: SequencerReduxState, { newState }) => newState,
  }),
  ADD_VOICE: buildActionGroup({
    actionCreator: () => ({ type: 'ADD_VOICE' }),
    subReducer: (state: SequencerReduxState) => ({
      ...state,
      marks: [...state.marks, R.times(() => false, state.marks[0]!.length)],
    }),
  }),
  REMOVE_VOICE: buildActionGroup({
    actionCreator: (voiceIx: number) => ({ type: 'REMOVE_VOICE', voiceIx }),
    subReducer: (state: SequencerReduxState, { voiceIx }) => {
      // Always must have at least one voice
      if (state.marks.length === 1) {
        return state;
      }

      return {
        ...state,
        marks: R.remove(voiceIx, 1, state.marks),
      };
    },
  }),
  MARK: buildActionGroup({
    actionCreator: (rowIx: number, colIx: number) => ({ type: 'MARK', rowIx, colIx }),
    subReducer: (state: SequencerReduxState, { rowIx, colIx }) => ({
      ...state,
      marks: R.set(R.lensPath([rowIx, colIx]), true, state.marks),
    }),
  }),
  UNMARK: buildActionGroup({
    actionCreator: (rowIx: number, colIx: number) => ({ type: 'UNMARK', rowIx, colIx }),
    subReducer: (state: SequencerReduxState, { rowIx, colIx }) => ({
      ...state,
      marks: R.set(R.lensPath([rowIx, colIx]), false, state.marks),
    }),
  }),
  SET_IS_PLAYING: buildActionGroup({
    actionCreator: (isPlaying: boolean) => ({ type: 'SET_IS_PLAYING', isPlaying }),
    subReducer: (state: SequencerReduxState, { isPlaying }) => {
      if (isPlaying === getIsPlaying(state.playingStatus)) {
        return state;
      }

      if (isPlaying) {
        // TODO
        throw new UnimplementedError();
      } else {
        // TODO
        throw new UnimplementedError();
      }
    },
  }),
  SET_VOICE_TARGET: buildActionGroup({
    actionCreator: (voiceIx: number, newTarget: VoiceTarget) => ({
      type: 'SET_VOICE_TARGET',
      voiceIx,
      newTarget,
    }),
    subReducer: (state: SequencerReduxState, { voiceIx, newTarget }) => ({
      ...state,
      voices: R.set(R.lensIndex(voiceIx), newTarget, state.voices),
    }),
  }),
  ADD_MIDI_OUTPUT: buildActionGroup({
    actionCreator: () => ({ type: 'ADD_MIDI_OUTPUT' }),
    subReducer: (state: SequencerReduxState) => ({
      ...state,
      midiOutputs: [
        ...state.midiOutputs,
        buildMIDINode(() => {
          throw new UnreachableException('MIDI output of sequencer has no inputs');
        }),
      ],
    }),
  }),
  REMOVE_MIDI_OUTPUT: buildActionGroup({
    actionCreator: (index: number) => ({ type: 'REMOVE_MIDI_OUTPUT', index }),
    subReducer: (state: SequencerReduxState, { index }) => {
      const removed = state.midiOutputs[index];
      if (!removed) {
        return state;
      }

      // Disconnect any voices that were targeting this output
      const updatedVoices = state.voices.map(voice => {
        if (voice.type !== 'midi' || voice.synthIx !== index) {
          return voice;
        }

        return { ...voice, synthIx: null };
      });

      removed.disconnect();
      removed.getInputCbs().onClearAll();

      return {
        ...state,
        voices: updatedVoices,
        midiOutputs: R.init(state.midiOutputs),
      };
    },
  }),
};

export const buildSequencerReduxInfra = (initialState: SequencerReduxState) => {
  const modules = {
    sequencer: buildModule<SequencerReduxState, typeof actionGroups>(initialState, actionGroups),
  };

  return buildStore<typeof modules>(modules);
};

export type SequencerReduxInfra = ReturnType<typeof buildSequencerReduxInfra>;

const DEFAULT_WIDTH = 16 as const;

export const buildInitialState = (): SequencerReduxState => ({
  voices: [{ type: 'sample', sampleIx: null }], // TODO
  sampleBank: [], // TODO
  marks: [R.times(() => false, DEFAULT_WIDTH)], // TODO
  bpm: 80,
  playingStatus: { type: 'NOT_PLAYING' as const },
  outputGainNode: new GainNode(ctx),
  midiOutputs: [],
  schedulerScheme: SchedulerScheme.Stable,
});
