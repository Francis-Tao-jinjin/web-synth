import React, { Suspense, useState, useCallback } from 'react';
import { connect } from 'react-redux';
import ace from 'ace-builds';
import ControlPanel, { Button, Custom } from 'react-control-panel';
import * as R from 'ramda';
// tslint:disable-next-line:no-submodule-imports
import 'ace-builds/webpack-resolver';

import { State as ReduxState } from '../redux';
import { actionCreators } from '../redux/reducers/faustEditor';
import { Effect } from '../redux/reducers/effects';
import buildControlPanel from './uiBuilder';
import buildInstance from './buildInstance';
import importObject from './faustModuleImportObject';
import { EffectPickerCustomInput } from '../controls/faustEditor';
import { BACKEND_BASE_URL } from '../conf';
import { Without } from '../types';

const { setActiveInstance, clearActiveInstance, setEditorContent } = actionCreators;

ace.require('ace/theme/twilight');

const ReactAce = React.lazy(() => import('react-ace'));

export interface FaustModuleInstance extends ScriptProcessorNode {
  getParamValue: (path: string) => number;
  setParamValue: (path: string, val: number) => void;
}

const FAUST_COMPILER_ENDPOINT =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:4565/compile'
    : 'https://faust.ameo.design/compile';

const styles: { [key: string]: React.CSSProperties } = {
  root: {
    display: 'flex',
    flexDirection: 'row',
  },
  codeEditor: {
    display: 'flex',
    flex: 1,
  },
  errorConsole: {
    display: 'flex',
    flex: 1,
    color: '#eee',
    marginLeft: 10,
    fontFamily: "'Oxygen Mono'",
    maxHeight: 600,
    border: '1px solid #555',
    backgroundColor: 'rgba(44,44,44,0.3)',
    maxWidth: '40vw',
  },
  buttonsWrapper: {
    display: 'flex',
    flexDirection: 'row',
    padding: 8,
  },
  editor: {
    border: '1px solid #555',
  },
  spectrumVizCanvas: {
    backgroundColor: '#000',
    imageRendering: 'crisp-edges',
  },
};

type StateProps = Pick<ReduxState['faustEditor'], 'instance' | 'controlPanel' | 'editorContent'>;

const mapDispatchToProps = { setActiveInstance, clearActiveInstance, setEditorContent };

type DispatchProps = typeof mapDispatchToProps;

type FaustEditorProps = StateProps & DispatchProps & { children: undefined };

const mapStateToProps = ({ faustEditor }: ReduxState) => ({
  instance: faustEditor.instance,
  controlPanel: faustEditor.controlPanel,
  editorContent: faustEditor.editorContent,
});

const enhance = connect<StateProps, DispatchProps, {}>(
  mapStateToProps,
  mapDispatchToProps
);

const createCompileButtonClickHandler = (
  editorContent: string,
  setCompileErrMsg: (errMsg: string) => void,
  setActiveInstance: (faustInstance: FaustModuleInstance, dspDefProps: object) => void
) => async () => {
  const formData = new FormData();
  formData.append('code.faust', new Blob([editorContent], { type: 'text/plain' }));

  const res = await fetch(FAUST_COMPILER_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errMsg = await res.text();
    setCompileErrMsg(errMsg);
    return;
  }

  // The JSON definition for the module is set as a HTTP header, which we must extract and parse.
  const jsonModuleDefString = res.headers.get('X-Json-Module-Definition');
  if (!jsonModuleDefString) {
    setCompileErrMsg("The `X-Json-Module-Definition` header wasn't set on the response.");
    return;
  }

  setCompileErrMsg('');
  const dspDefProps = JSON.parse(jsonModuleDefString);

  const arrayBuffer = await res.arrayBuffer();

  const compiledModule = await WebAssembly.compile(arrayBuffer);
  const wasmInstance = new WebAssembly.Instance(compiledModule, importObject);

  const faustInstance = await buildInstance(wasmInstance, dspDefProps);
  setActiveInstance(faustInstance, dspDefProps);
};

interface EffectsPickerPanelPassedProps {
  state: object;
  setState: (newState: object) => void;
  loadEffect: (effect: Effect) => void;
}

interface EffectsPickerReduxProps {
  effects: Effect[];
}

type EffectsPickerPannelProps = EffectsPickerPanelPassedProps & EffectsPickerReduxProps;

/**
 * Creates a control panel that contains controls for browsing + loading shared/saved effects
 */
const EffectsPickerPanelInner: React.FunctionComponentFactory<EffectsPickerPanelPassedProps> = ({
  state,
  setState,
  loadEffect,
  effects,
}: EffectsPickerPannelProps) => (
  <ControlPanel
    state={state}
    onChange={(_label: string, _newValue: any, newState: object) => setState(newState)}
    position='bottom-right'
    draggable
  >
    <Custom label='load effect' renderContainer Comp={EffectPickerCustomInput} />
    <Button
      label='Load'
      action={() => loadEffect(effects.find(R.propEq('id', state['load effect']))!)}
    />
  </ControlPanel>
);

const EffectsPickerPanel = connect<
  { effects: Effect[] },
  {},
  EffectsPickerPanelPassedProps,
  ReduxState
>(({ effects: { sharedEffects } }) => ({
  effects: sharedEffects,
}))(EffectsPickerPanelInner);

const saveCode = async (effect: Without<Effect, 'id'>) => {
  const res = await fetch(`${BACKEND_BASE_URL}/effects`, {
    method: 'POST',
    body: JSON.stringify(effect),
  });

  if (!res.ok) {
    console.error(`Error saving code: ${await res.text()}`);
  }
};

const SaveControls = ({ editorContent }: { editorContent: string }) => {
  const [state, setState] = useState({ title: '', description: '' });

  return (
    <div>
      <p>
        Title{' '}
        <input
          type='text'
          value={state.title}
          onChange={evt => setState({ ...state, title: evt.target.value })}
        />
      </p>

      <p>
        Description{' '}
        <textarea
          value={state.description}
          onChange={evt => setState({ ...state, description: evt.target.value })}
        />
      </p>

      <button onClick={() => saveCode({ code: editorContent, ...state })}>Save</button>
    </div>
  );
};

const FaustEditor: React.FunctionComponent<{}> = ({
  instance,
  controlPanel: faustInstanceControlPanel,
  editorContent,
  setActiveInstance,
  clearActiveInstance,
  setEditorContent,
}: FaustEditorProps) => {
  const [compileErrMsg, setCompileErrMsg] = useState('');
  const [controlPanelState, setControlPanelState] = useState({});

  const handleCompileButtonClick = useCallback(
    createCompileButtonClickHandler(editorContent, setCompileErrMsg, setActiveInstance),
    [editorContent, setCompileErrMsg, setActiveInstance]
  );

  return (
    <Suspense fallback={<span>Loading...</span>}>
      <div style={styles.root}>
        <ReactAce
          theme='twilight'
          mode='text'
          showPrintMargin={false}
          onChange={newValue => setEditorContent(newValue)}
          name='ace-editor'
          width='40vw'
          value={editorContent}
          style={styles.editor}
        />

        <div style={styles.errorConsole}>{compileErrMsg}</div>
      </div>

      <div style={styles.buttonsWrapper}>
        <button onClick={handleCompileButtonClick} style={{ marginRight: 10 }}>
          Compile
        </button>
        {instance ? <button onClick={clearActiveInstance}>Stop</button> : null}
      </div>

      <SaveControls editorContent={editorContent} />

      <canvas
        width={1200}
        height={1024}
        id='spectrum-visualizer'
        style={styles.spectrumVizCanvas}
      />

      {faustInstanceControlPanel}

      <EffectsPickerPanel
        state={controlPanelState}
        setState={setControlPanelState}
        loadEffect={(effect: Effect) => setEditorContent(effect.code)}
      />
    </Suspense>
  );
};

const EnhancedFaustEditor = enhance(FaustEditor);

export default EnhancedFaustEditor;
