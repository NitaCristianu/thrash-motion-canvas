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
import { CachedFrame, frameCache } from './utils/frameCache';

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

    public isLoading(){
        return this._loader.isLoading();
    }

    public renderSilhouetteSnapshot(options: {
        camera?: THREE.Camera,
        root?: THREE.Object3D,
        cacheKey?: string,
        useCache?: boolean,
        verbose?: boolean,
    } = {}): CachedFrame<HTMLCanvasElement> | undefined {
        const sourceCamera = options.camera ?? this.selectedCamera;
        const sourceRoot = options.root ?? this.selectedScene;
        const useCache = options.useCache ?? false;
        const verbose = options.verbose ?? false;
        const logMessage = (message: string) => {
            if (verbose) {
                const logger = this.logger as any;
                if (logger && typeof logger.debug === 'function') {
                    logger.debug(message);
                } else if (logger && typeof logger.log === 'function') {
                    logger.log(message);
                }
            }
        };

        if (!sourceCamera || !sourceRoot) {
            this.logger.warn?.("Unable to render silhouette snapshot without a camera and root object.");
            return undefined;
        }

        const size = this.computedSize();
        if (size.x <= 0 || size.y <= 0) {
            this.logger.warn?.("Computed size is zero; skipping silhouette snapshot render.");
            return undefined;
        }

        const cacheId = options.cacheKey ?? frameCache.createId("silhouette");
        if (useCache) {
            const cached = frameCache.get(cacheId);
            if (cached) {
                logMessage(`Silhouette snapshot cache hit for id '${cacheId}'.`);
                return cached;
            }
            logMessage(`No cache entry for id '${cacheId}'. Rendering new snapshot.`);
        } else {
            logMessage(`Rendering silhouette snapshot without using cache (id '${cacheId}').`);
        }

        const rootClone = sourceRoot.clone(true);
        const sceneClone = rootClone instanceof THREE.Scene ? rootClone : new THREE.Scene();
        if (!(rootClone instanceof THREE.Scene)) {
            sceneClone.add(rootClone);
        }

        const disposableMaterials: THREE.Material[] = [];
        sceneClone.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            const originalMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const isTransparent = originalMaterials.some((mat) => {
                const material = mat as THREE.Material;
                return material.transparent || (material as any).opacity < 1;
            });

            const material = new THREE.MeshBasicMaterial({
                color: isTransparent ? 0x808080 : 0xffffff,
            });
            disposableMaterials.push(material);
            mesh.material = material;
        });

        const cameraClone = sourceCamera.clone() as THREE.Camera;
        if ((cameraClone as THREE.PerspectiveCamera).isPerspectiveCamera) {
            const perspective = cameraClone as THREE.PerspectiveCamera;
            const aspect = size.x / size.y;
            if (Number.isFinite(aspect)) {
                perspective.aspect = aspect;
                perspective.updateProjectionMatrix();
            }
        } else if ((cameraClone as THREE.OrthographicCamera).isOrthographicCamera) {
            const ortho = cameraClone as THREE.OrthographicCamera;
            // Maintain same size proportions by scaling frustum
            const halfW = (ortho.right - ortho.left) / 2;
            const halfH = (ortho.top - ortho.bottom) / 2;
            const aspect = size.x / size.y;
            if (Number.isFinite(aspect) && aspect > 0) {
                const targetHalfW = halfH * aspect;
                ortho.left = -targetHalfW;
                ortho.right = targetHalfW;
                ortho.updateProjectionMatrix();
            }
        }

        sceneClone.background = null;

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(size.x, size.y, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        renderer.render(sceneClone, cameraClone);

        const output = document.createElement('canvas');
        output.width = size.x;
        output.height = size.y;
        const ctx = output.getContext('2d');
        if (ctx) {
            ctx.drawImage(renderer.domElement, 0, 0);
        }

        renderer.dispose();
        disposableMaterials.forEach((mat) => mat.dispose?.());

        const result: CachedFrame<HTMLCanvasElement> = {
            id: cacheId,
            payload: output,
            createdAt: Date.now(),
        };

        if (useCache) {
            logMessage(`Caching silhouette snapshot under id '${cacheId}'.`);
            return frameCache.set(cacheId, output);
        }

        return result;
    }
}
