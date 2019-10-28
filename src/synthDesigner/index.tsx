import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Try, Option } from 'funfix-core';
import { buildStore } from 'jantix';
import { reducer as formReducer } from 'redux-form';
import { Map } from 'immutable';

import {
  SynthDesignerState,
  serializeSynthModule,
  deserializeSynthModule,
  getInitialSynthDesignerState,
} from 'src/redux/modules/synthDesigner';
import SynthDesigner from './SynthDesigner';
import { AudioConnectables } from 'src/patchNetwork';
import synthDesignerModule from 'src/redux/modules/synthDesigner';

const buildSynthDesignerRedux = () => {
  const modules = {
    synthDesigner: synthDesignerModule,
  };

  return buildStore<typeof modules>(modules, undefined, { form: formReducer });
};

export type SynthDesignerReduxStore = ReturnType<
  ReturnType<typeof buildSynthDesignerRedux>['getState']
>;

const getRootNodeId = (vcId: string) => `synth-designer-react-root_${vcId}`;

/**
 * Global map of state key to Redux infrastructure
 */
let STATE_MAP: Map<string, ReturnType<typeof buildSynthDesignerRedux>> = Map();

export const getReduxInfra = (stateKey: string) => {
  const reduxInfra = STATE_MAP.get(stateKey);
  if (!reduxInfra) {
    throw new Error(`No Redux state entry for state key "${stateKey}"`);
  }

  return reduxInfra;
};

export const init_synth_designer = (stateKey: string) => {
  // Create a fresh Redux store just for this instance.  It makes things a lot simpler on the Redux side due to the
  // complexity of the Redux architecture for synth designer; we'd have to add an id param to all actions and store
  // everything in a big map.
  const reduxInfra = buildSynthDesignerRedux();
  STATE_MAP = STATE_MAP.set(stateKey, reduxInfra);

  // Retrieve the initial synth designer content from `localStorage` (if it's set)
  const initialState = Try.of(() =>
    Option.of(localStorage.getItem(stateKey))
      .map(serializedState => JSON.parse(serializedState))
      .map(
        ({ synths, ...rest }) =>
          ({ synths: synths.map(deserializeSynthModule), ...rest } as SynthDesignerState)
      )
      .orNull()
  )
    .recoverWith(err => {
      console.warn(
        'Error deserializing synth designer state from JSON; clearing and defaulting to empty',
        err
      );

      return Try.of(() => {
        throw err;
      });
    })
    .getOrElseL(() => {
      localStorage.removeItem(stateKey);
      return getInitialSynthDesignerState(true);
    });

  // Create the base dom node for the faust editor
  const synthDesignerBase = document.createElement('div');
  const vcId = stateKey.split('_')[1]!;
  synthDesignerBase.id = getRootNodeId(vcId);
  synthDesignerBase.setAttribute(
    'style',
    'z-index: 2; width: 100vw; height: 100vh; position: absolute; top: 0; left: 0;'
  );

  // Mount the newly created Faust editor and all of its accompanying components to the DOM
  document.getElementById('content')!.appendChild(synthDesignerBase);
  ReactDOM.render(
    <Provider store={reduxInfra.store}>
      <SynthDesigner initialState={initialState} stateKey={stateKey} />
    </Provider>,
    synthDesignerBase
  );
};

export const hide_synth_designer = (vcId: string) => {
  const rootNode = document.getElementById(getRootNodeId(vcId));
  if (!rootNode) {
    console.warn(`Tried to hide synth designer with id ${vcId} but it wasn't mounted`);
    return;
  }

  rootNode.style.display = 'none';
};

export const unhide_synth_designer = (vcId: string) => {
  const rootNode = document.getElementById(getRootNodeId(vcId));
  if (!rootNode) {
    console.warn(`Tried to unhide synth designer with id ${vcId} but it wasn't mounted`);
    return;
  }

  rootNode.style.display = 'block';
};

export const cleanup_synth_designer = (stateKey: string): string => {
  const { synths } = getReduxInfra(stateKey).getState().synthDesigner;
  const designerState = JSON.stringify({
    synths: synths.map(serializeSynthModule),
  });
  const vcId = stateKey.split('_')[1]!;
  const rootNode = document.getElementById(getRootNodeId(vcId));
  if (!rootNode) {
    return designerState;
  }

  ReactDOM.unmountComponentAtNode(rootNode);
  rootNode.remove();
  return designerState;
};

export const get_synth_designer_audio_connectables = (stateKey: string): AudioConnectables => {
  const { synths, spectrumNode } = getReduxInfra(stateKey).getState().synthDesigner;

  return {
    vcId: stateKey.split('vc_')[1]!,
    inputs: synths.reduce(
      (acc, synth, i) =>
        acc
          .set(`synth_${i}_detune`, { node: synth.detuneCSN.offset, type: 'number' })
          .set(`synth_${i}_filter_frequency`, { node: synth.filterCSNs.frequency, type: 'number' })
          .set(`synth_${i}_filter_q`, { node: synth.filterCSNs.Q, type: 'number' })
          .set(`synth_${i}_filter_detune`, { node: synth.filterCSNs.detune, type: 'number' }),
      Map<string, { node: AudioParam | AudioNode; type: string }>()
    ),
    outputs: spectrumNode
      ? Map<string, { node: AudioNode; type: string }>().set('masterOutput', {
          node: spectrumNode,
          type: 'customAudio',
        })
      : Map<string, { node: AudioNode; type: string }>(),
  };
};
