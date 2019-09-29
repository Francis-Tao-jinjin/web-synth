import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { useOnce } from 'ameo-utils/util/react';
import * as R from 'ramda';
import ControlPanel from 'react-control-panel';

import { actionCreators, ReduxStore, dispatch } from 'src/redux';
import {
  SynthDesignerState,
  Waveform,
  SynthModule,
  EffectType,
} from 'src/redux/modules/synthDesigner';
import './SynthDesigner.scss';
import { buildEffect } from 'src/synthDesigner/effects';
import FilterModule from './Filter';

declare class WavyJones extends AnalyserNode {
  public lineColor: string;
  public lineThickness: number;
  constructor(ctx: AudioContext, nodeId: string, updateIntervalMs?: number);
}

const SynthModuleComp: React.FC<{ index: number; synth: SynthModule }> = ({ index, synth }) => {
  return (
    <div className='synth-module'>
      <div
        className='synth-remove-button'
        onClick={() => dispatch(actionCreators.synthDesigner.DELETE_SYNTH_MODULE(index))}
      >
        X
      </div>

      <ControlPanel
        settings={[
          {
            type: 'range',
            label: 'volume',
            min: 0,
            initial: 0.1,
            max: 4,
            step: 0.05,
          },
          {
            type: 'select',
            label: 'waveform',
            options: Object.values(Waveform),
            initial: Waveform.Sine,
          },
          {
            type: 'range',
            label: 'unison',
            min: 1,
            initial: 1,
            max: 32,
            step: 1,
          },
          {
            type: 'range',
            label: 'detune',
            min: -300,
            initial: 0,
            max: 300,
            step: 0.5,
          },
        ]}
        onChange={(key: string, val: any) => {
          switch (key) {
            case 'waveform': {
              dispatch(actionCreators.synthDesigner.SET_WAVEFORM(index, val));
              break;
            }
            case 'unison': {
              dispatch(actionCreators.synthDesigner.SET_UNISON(index, val));
              break;
            }
            case 'volume': {
              dispatch(actionCreators.synthDesigner.SET_MASTER_GAIN(index, val));
              break;
            }
            case 'detune': {
              dispatch(actionCreators.synthDesigner.SET_DETUNE(index, val));
              break;
            }
            default: {
              console.warn('Unhandled key in synth control panel: ', key);
            }
          }
        }}
        state={useMemo(
          () => ({
            waveform: synth.waveform,
            volume: synth.masterGain,
            unison: synth.oscillators.length,
            detune: synth.detune,
          }),
          [synth.waveform, synth.oscillators.length, synth.masterGain, synth.detune]
        )}
      />

      <FilterModule synthIx={index} params={synth.filter.params} />
    </div>
  );
};

const EffectModuleComp: React.FC<{
  synthIx: number;
  effectIx: number;
  params: { [key: string]: any };
  wetness: number;
  isBypassed: boolean;
  effectSettings: { [key: string]: any }[];
}> = ({ params, synthIx, effectIx, wetness, isBypassed, effectSettings }) => {
  const mergedState = useMemo(() => ({ ...params, wetness, isBypassed }), [
    params,
    wetness,
    isBypassed,
  ]);

  const combinedSettings = useMemo(
    () => [
      { type: 'checkbox', label: 'bypass', initial: true },
      { type: 'range', label: 'wetness', min: 0, max: 1, initial: 1, step: 0.01 },
      ...effectSettings,
    ],
    [effectSettings]
  );

  return (
    <div className='effect-module'>
      <ControlPanel
        settings={combinedSettings}
        state={mergedState}
        onChange={(key: string, val: any) => {
          switch (key) {
            case 'wetness': {
              dispatch(actionCreators.synthDesigner.SET_EFFECT_WETNESS(synthIx, effectIx, val));
              break;
            }
            case 'bypass': {
              dispatch(actionCreators.synthDesigner.SET_EFFECT_BYPASSED(synthIx, effectIx, val));
              break;
            }
            default: {
              dispatch(actionCreators.synthDesigner.SET_EFFECT_PARAM(synthIx, effectIx, key, val));
            }
          }
        }}
      />
    </div>
  );
};

const mapStateToProps = ({ synthDesigner }: ReduxStore) => ({ synthDesignerState: synthDesigner });

const SynthDesigner: React.FC<
  {
    initialState?: SynthDesignerState | null;
  } & ReturnType<typeof mapStateToProps>
> = ({ initialState, synthDesignerState }) => {
  const oscilloscopeNode = useRef<HTMLDivElement | null>(null);
  const wavyJonesInstance = useRef<WavyJones | null>(null);
  const [selectedEffectType, setSelectedEffectType] = useState<EffectType>(EffectType.Bitcrusher);

  useEffect(() => {
    if (
      !oscilloscopeNode.current ||
      wavyJonesInstance.current ||
      R.isEmpty(synthDesignerState.synths)
    ) {
      return;
    }

    wavyJonesInstance.current = new WavyJones(new AudioContext(), 'oscilloscope', 40);

    wavyJonesInstance.current.lineColor = '#FFF';
    wavyJonesInstance.current.lineThickness = 1.2;

    dispatch(actionCreators.synthDesigner.SET_WAVY_JONES_INSTANCE(wavyJonesInstance.current));
  });

  useOnce(() => {
    if (initialState) {
      dispatch(actionCreators.synthDesigner.SET_STATE(initialState));
    }
  });

  useEffect(() => {
    const downHandler = (evt: KeyboardEvent) => {
      if (['z', 'x'].includes(evt.key)) {
        dispatch(actionCreators.synthDesigner.GATE(440));
      }
    };
    const upHandler = (evt: KeyboardEvent) => {
      if (['z', 'x'].includes(evt.key)) {
        dispatch(actionCreators.synthDesigner.UNGATE());
      }
    };

    document.addEventListener('keydown', downHandler);
    document.addEventListener('keyup', upHandler);

    return () => {
      document.removeEventListener('keydown', downHandler);
      document.removeEventListener('keyup', upHandler);
    };
  });

  return (
    <>
      <div className='synth-designer'>
        {synthDesignerState.synths.map((synth, i) => (
          <SynthModuleComp key={i} synth={synth} index={i}>
            {synth.effects.map((effect, effectIx) => (
              <EffectModuleComp
                key={effectIx}
                synthIx={i}
                effectIx={effectIx}
                wetness={effect.wetness}
                isBypassed={effect.isBypassed}
                params={effect.params}
                effectSettings={effect.effect.node.getSettingDefs()}
              />
            ))}

            <div className='add-effect'>
              <select
                value={selectedEffectType}
                onChange={evt => setSelectedEffectType(evt.target.value as EffectType)}
              >
                {Object.entries(EffectType).map(([key, val]) => (
                  <option key={val} value={val}>
                    {key}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const { effect, params } = buildEffect(selectedEffectType);
                  dispatch(actionCreators.synthDesigner.ADD_EFFECT(i, effect, params));
                }}
              >
                Add Effect
              </button>
            </div>
          </SynthModuleComp>
        ))}

        <button
          style={{ marginTop: 6 }}
          onClick={() => dispatch(actionCreators.synthDesigner.ADD_SYNTH_MODULE())}
        >
          Add Synth Module
        </button>
      </div>

      <div id='oscilloscope' ref={oscilloscopeNode}></div>

      <button
        onMouseDown={() => dispatch(actionCreators.synthDesigner.GATE(440))}
        onMouseUp={() => dispatch(actionCreators.synthDesigner.UNGATE())}
      >
        Gate
      </button>
    </>
  );
};

export default connect(mapStateToProps)(SynthDesigner);