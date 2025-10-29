import * as THREE from 'three';
import { Rect, RectProps } from "@motion-canvas/2d";
import Loader from "./utils/Loader";
import importScene, { sceneJSON } from './utils/importScene';
import { Color, Logger, PossibleColor, useLogger } from '@motion-canvas/core';
import Renderer from './utils/Renderer';
import ObjectWrapper from './wrappers/ObjectWrapper';
import { getVector3, PossibleVector3 } from './utils/vectors';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import PerspectiveCameraWrapper from './wrappers/CameraWrapper';

export interface ExperienceProps extends RectProps {
    initialScenePreset?: sceneJSON
}

/*

    Experience doesn't directly represent a THREE.Scene
    It's built to support multiple Scenes / Camera and additional support features

*/
export default class Experience extends Rect {

    private _loader: Loader;
    private _renderer: Renderer;
    public logger: Logger | Console;

    private scenes: THREE.Scene[];
    private cameras: THREE.Camera[]

    public selectedScene: THREE.Scene;
    public selectedCamera: THREE.Camera;

    public assets = {
        meshes: {},
        materials: {},
        geometries: {}
    }


    constructor(props: ExperienceProps) {
        super({ size: '100%', ...props });

        this._loader = new Loader(this);
        this._renderer = new Renderer(this);
        this.logger = useLogger();
        this.scenes = [];
        this.cameras = [];

        this.selectedScene = this.createScene(props.initialScenePreset);
        this.selectedCamera = this.createCamera(this.selectedScene);

    }

    public createScene(from?: sceneJSON): THREE.Scene {
        const data = importScene(from);
        let scene: THREE.Scene = data.scene;

        this.assets.geometries = data.geomMap;
        this.assets.materials = data.matMap;

        this.scenes.push(scene);

        return scene;
    }

    public createCamera(object?: THREE.Camera | THREE.Scene): THREE.Camera {
        if (typeof object == 'object') {
            if (object instanceof THREE.Scene) {
                // grabs camera from scene
                const scene = object;

                // perform search (not efficient)
                let camera: THREE.Camera;
                const inspecting = [...scene.children];
                while (inspecting.length > 0) {
                    const item = inspecting.pop();
                    if (item instanceof THREE.Camera) {
                        camera = item;
                        break;
                    }
                    inspecting.push(...item.children);
                }

                if (camera) {
                    this.cameras.push(camera);
                    return camera
                }
                // no camera case
                this.logger.warn("No camera found in scene. Creating new one instead." + scene.id);
                return this.createCamera();

            } else {
                this.cameras.push(object);
                return object;
            }
        }
        // instantiate default camera
        const camera = new THREE.PerspectiveCamera();

        const defaultpos = new THREE.Vector3(1, 1, 1);
        camera.position.copy(defaultpos);

        this.cameras.push(camera);

        return camera;
    }

    protected override draw(context: CanvasRenderingContext2D) {
        const size = this.computedSize();
        const { width, height } = size;

        const renderElement = this._renderer.render(size);
        context.drawImage(
            renderElement,
            0,
            0,
            width,
            height,
            width / -2,
            height / -2,
            width,
            height
        )

        super.draw(context);
    }

    get<T extends THREE.Object3D>(name: string) {
        // returns a wrapped refrence to the first child named so

        // perform search (not efficient)
        var item =
            this.selectedScene.getObjectByName(name);

        if (item)
            return new ObjectWrapper(item) as ObjectWrapper<T>;

        this.logger.error("Object called " + name + " not found!")

    }

    loadmeshes(meshes: {
        [key: string]: {
            scale?: PossibleVector3,
            position?: PossibleVector3,
            rotation?: THREE.Euler,
            path: string
        }
    }) {
        // const meshesmap = new Map(Object.entries(meshes));

        this.assets.meshes = {};

        Object.entries(meshes).forEach(([name, modeldata]) => {
            const { scale, position, rotation, path } = modeldata;

            // load model

            let template: THREE.Object3D;
            this._loader.loadGLTF(path as string, (gltf) => {
                template = gltf.scene;

                // perform search (not efficient)
                const inspecting = [...this.selectedScene.children];
                this.selectedScene.getObjectsByProperty('name', name).map(item => {
                    let model = template.clone();

                    // base props
                    model.position.copy(item.position);
                    model.scale.copy(item.scale);
                    model.quaternion.copy(item.quaternion);        // use quaternion, not rotation

                    // optional deltas
                    if (position) model.position.add(getVector3(position));

                    if (rotation) {
                        // convert extra rotation to a quaternion and COMPOSE it
                        const order = item.rotation?.order ?? 'XYZ';
                        const qDelta = new THREE.Quaternion().setFromEuler(
                            rotation.isEuler ? rotation : new THREE.Euler(rotation.x, rotation.y, rotation.z, order)
                        );
                        model.quaternion.multiply(qDelta); // applies qDelta AFTER current orientation
                        // use m.quaternion.premultiply(qDelta) if you want it BEFORE
                    }

                    if (scale) model.scale.multiply(getVector3(scale)); // component-wise scale GF F

                    // delete and put
                    item.parent.add(model);
                    item.removeFromParent();
                });
                

            });

        })
    }

    addGeometries(geometries: Map<string, THREE.BufferGeometry>) {
        this.assets.geometries = { ...this.assets.geometries, ...geometries };
    }

    addMaterials(materials: Map<string, THREE.Material>) {
        this.assets.materials = { ...this.assets.materials, ...materials };
    }

    environment(path: string, properites = {
        sky: false,
        intensity: 1,
    }) {
        this._loader.loadTexture(path, (texture) => {
            this.selectedScene.environment = texture;
            if (properites.sky) this.selectedScene.background = texture;
            if (properites.intensity) this.selectedScene.environmentIntensity = properites.intensity;
        });
    }

    background(color: PossibleColor) {
        this.selectedScene.background = new THREE.Color(new Color(color).hex());
    }

    getCamera() {

        return new PerspectiveCameraWrapper(this.get<THREE.PerspectiveCamera>("PerspectiveCamera").object);
    }

}
