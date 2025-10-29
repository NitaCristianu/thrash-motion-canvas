import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import Experience from "../Experience";
import { Texture, TextureLoader } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader";

const CACHE_GLTF: { [name: string]: GLTF } = {};
const CACHE_TEXTURE: { [name: string]: Texture } = {};

export default class Loader {

    private master: Experience
    private toload: number = 0;

    private gltfLoader: GLTFLoader;
    private textureLoader: TextureLoader;
    private hdrLoader: HDRLoader;

    constructor(experience: Experience) {
        this.master = experience;

        this.setLoaders();
    }

    public setLoaders() {
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new TextureLoader();
        this.hdrLoader = new HDRLoader();
    }

    public loadGLTF(path: string, callback: (gltf: GLTF) => void) {
        // Serve from cache if available and keep async semantics
        const cached = CACHE_GLTF[path];
        if (cached) {
            // Ensure callback runs on next tick to mirror loader async behavior
            setTimeout(() => callback(cached), 0);
            return;
        }

        this.toload += 1;

        this.gltfLoader.load(path,
            (data: GLTF) => {
                // loaded
                CACHE_GLTF[path] = data;
                this.toload -= 1;
                callback(data);
                this.master.logger.debug("loaded gltf : \n" + path);
            },
            (progress) => {
                this.master.logger.debug("loading gltf ... \n" + path);
            },
            (err) => {
                this.toload = Math.max(0, this.toload - 1);
                this.master.logger.error("the gltf at " + path + "couldn't be loaded. \n " + err);
            }
        )

    }

    public loadTexture(path: string, callback: (texture: Texture) => void) {

        // Serve from cache if available and keep async semantics
        const cached = CACHE_TEXTURE[path];
        if (cached) {
            // Ensure callback runs on next tick to mirror loader async behavior
            setTimeout(() => callback(cached), 0);
            return;
        }

        this.toload += 1;

        let loader = this.textureLoader;
        if (path.endsWith(".hdr")){
            loader = this.hdrLoader;
        }
        
        loader.load(path, (texture => {
            CACHE_TEXTURE[path] = texture;
            this.toload -= 1;
            callback(texture);
            this.master.logger.debug("loaded texture : \n" + path);
        }), (progress => {
            this.master.logger.debug("loading texture ... \n" + path);

        }), (err) => {
            this.toload = Math.max(0, this.toload - 1);
            this.master.logger.error("the texture at " + path + "couldn't be loaded. \n " + err);

        })
    }

    public isLoading() { return this.toload > 0 }

}
