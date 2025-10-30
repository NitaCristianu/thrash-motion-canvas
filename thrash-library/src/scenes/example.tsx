import { Circle, Img, makeScene2D, Node, Txt } from '@motion-canvas/2d';
import { createRef, easeOutBack, waitFor } from '@motion-canvas/core';
import Experience from '../thrash/Experience';

import json from '../demo-scenes/sphere-scene-2.json';
import { AmbientLight, Mesh, PerspectiveCamera, Vector3 } from 'three';
import PerspectiveCameraWrapper from '../thrash/wrappers/CameraWrapper';

export default makeScene2D(function* (view) {

  const core = <Experience
    initialScenePreset={json}
  /> as Experience;
  core.loadmeshes({
    Sphere: { path: '/models/horse_head_4k.gltf', scale: 10, position: new Vector3(0, -.5, 0) }
  });
  core.background("#fff");
  core.environment('/hdr/blue_photo_studio_4k.hdr', { sky: false, intensity: 1 });

  view.add(core);

  const ball = core.get<Mesh>("Sphere");
  const camera = core.getCamera();

  // Use wrapper lookat so orbit can remember the target center

  yield* camera.lookat(ball.positionget(), 0);
  yield* camera.zoomin(40, 2);

  const snapshot = core.renderSilhouetteSnapshot({ cacheKey: "horse" })
  if (!snapshot) {
    core.logger.warn?.('Silhouette snapshot is undefined');
    return;
  }
  const dataUrl = snapshot.payload.toDataURL('image/png');
  const txt = createRef<Txt>();
  view.add(
    <Node composite cache >
      <Img
        src={dataUrl}
        />
      <Txt
        ref={txt}
        compositeOperation={'source-out'}
        text={"Hello world"}
        scaleY={0}
        fill={'red'}
        fontSize={220}
      />
      view.add(txt);

    </Node>

  );
  yield* txt().scale(1, .5, easeOutBack);
  yield* txt().x(-500, 1).to(500, 1).back(1);
  yield* txt().scale(0, 1);
  yield txt().parent().remove();

  yield* camera.orbit();

  yield* waitFor(2);


});
