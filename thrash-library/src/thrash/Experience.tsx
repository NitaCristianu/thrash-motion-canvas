import * as THREE from 'three';
import { Rect, RectProps } from "@motion-canvas/2d";
import Loader from "./utils/Loader";
import importScene, { sceneJSON } from './utils/importScene';
import { Logger, useLogger } from '@motion-canvas/core';
import Renderer from './utils/Renderer';
import ObjectWrapper from './wrappers/ObjectWrapper';

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
        const scene = from ? importScene(from) : new THREE.Scene();

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
        const camera = new THREE.Camera();

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
        const inspecting = [...this.selectedScene.children];
        while (inspecting.length > 0) {
            const item = inspecting.pop();
            if (item.name == name) {
                return new ObjectWrapper(item) as ObjectWrapper<T>;
            }
            inspecting.push(...item.children);
        }

        this.logger.error("Object called " + name + " not found!")
        
    }

}