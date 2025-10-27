import { Circle, makeScene2D } from '@motion-canvas/2d';
import { createRef } from '@motion-canvas/core';
import Experience from '../thrash/Experience';

import json from '../demo-scenes/basic-cube-scene.json';

export default makeScene2D(function* (view) {

  const core = <Experience
    initialScenePreset={json}
  /> as Experience;

  view.add(core);

});
