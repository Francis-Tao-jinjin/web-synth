import React from 'react';
import { connect } from 'react-redux';

import PolySynthControls from './controls/polysynth';
import { PolySynth } from './synth';
import './index.css';

const mapStateToProps = ({ synths: { synths } }: { synths: { synths: PolySynth[] } }) => ({
  synths,
});

const App: React.FC<{ engine: typeof import('./engine') } & ReturnType<typeof mapStateToProps>> = ({
  synths,
  engine,
}) => <PolySynthControls engine={engine} synth={synths[0]} />;

const EnhancedApp = connect(mapStateToProps)(App);

export default EnhancedApp;
