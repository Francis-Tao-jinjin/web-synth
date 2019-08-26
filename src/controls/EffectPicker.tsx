import React from 'react';
import { connect } from 'react-redux';

import { State as ReduxState } from '../redux';
import { actionCreators as effectsActionCreators, Effect } from '../redux/reducers/effects';
import { useOnce } from '../hooks';
import { BACKEND_BASE_URL } from '../conf';
import defaultEffects from './defaultEffects.json';

interface StateProps {
  effects: Effect[];
}

const mapDispatchToProps = {
  addEffects: effectsActionCreators.addEffects,
};

type DispatchProps = typeof mapDispatchToProps;

interface PassedProps {
  onChange: (newId: number) => void;
  value: number;
}

type EffectPickerProps = StateProps & DispatchProps & PassedProps;

export const fetchEffects = async (): Promise<Effect[]> => {
  try {
    const effects = await fetch(`${BACKEND_BASE_URL}/effects`);
    return effects.json();
  } catch (err) {
    console.warn('Error fetching effects from server; using local effects file.');
    return defaultEffects;
  }
};

/**
 * Creates an interface that can be used to select effects to use.
 */
const EffectPicker: React.FunctionComponent<PassedProps> = ({
  value,
  onChange,
  effects,
  addEffects,
}: EffectPickerProps) => {
  useOnce(async () => {
    const effects = await fetchEffects();
    addEffects(effects);
    onChange(effects[0].id);
  });

  return (
    <select value={value} onChange={evt => onChange(parseInt(evt.target.value, 10))}>
      {effects.map(effect => (
        <option key={effect.id} value={effect.id}>
          {effect.title}
        </option>
      ))}
    </select>
  );
};

const mapStateToProps: (reduxState: ReduxState) => StateProps = ({ effects }) => ({
  effects: effects.sharedEffects,
});

const enhance = connect<StateProps, DispatchProps, {}>(
  mapStateToProps,
  mapDispatchToProps
);

const EnhancedEffectPicker = enhance(EffectPicker);

export default EnhancedEffectPicker;
