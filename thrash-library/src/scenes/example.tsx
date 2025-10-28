import { Circle, makeScene2D } from '@motion-canvas/2d';
import { createRef } from '@motion-canvas/core';
import Experience from '../thrash/Experience';

import json from '../demo-scenes/standard-material-scene.json';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';

export default makeScene2D(function* (view) {

  const core = <Experience
    initialScenePreset={json}
  /> as Experience;
  
  view.add(core);

  const ball = core.get<Mesh>("Sphere");
  const camera = core.get<PerspectiveCamera>("PerspectiveCamera");
  
  yield* camera.zoomin(30, 2);
  yield* camera.zoomout(30, 2);

});
