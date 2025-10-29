import { Vector2 } from "@motion-canvas/core";
import { Vector2 as ThreeVec2 } from "three";
import Experience from "../Experience";
import { PerspectiveCamera, WebGLRenderer } from "three";


export default class Renderer {

    private master: Experience;
    private readonly webgl = new WebGLRenderer();

    constructor(experience: Experience) {
        this.master = experience;
        // Enable shadows for lights that castShadow
        this.webgl.shadowMap.enabled = true;
    }

    public render(size: Vector2) {
        const scene = this.master.selectedScene;
        const camera = this.master.selectedCamera;
        if (!camera || !scene) return;

        const pixelRatio = 1;

        if (size.x > 0 && size.y > 0) {
            // Keep camera projection in sync with current viewport
            if (camera instanceof PerspectiveCamera) {
                const nextAspect = size.x / size.y;
                if (camera.aspect !== nextAspect) {
                    camera.aspect = nextAspect;
                    camera.updateProjectionMatrix();
                }
            }
            
            const webgl_size = new ThreeVec2();
            this.webgl.getSize(webgl_size);

            if (webgl_size.x != size.x || webgl_size.y != size.y){
                this.webgl.setSize(size.x, size.y);
                this.webgl.setPixelRatio(pixelRatio);
            }


            // Render the scene using the configured camera
            this.webgl.render(scene, camera);
        }

        return this.webgl.domElement;
    }

}
