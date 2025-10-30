import { easeInOutCubic, easeInSine, easeOutSine, tween } from "@motion-canvas/core";
import { PerspectiveCamera, Vector3 } from "three";
import ObjectWrapper from "./ObjectWrapper";

export default class PerspectiveCameraWrapper extends ObjectWrapper<PerspectiveCamera> {

    *zoom(fov: number, time: number = 1, ease = easeInOutCubic) {
        const ref = this.object;
        const start = ref.fov;
        const target = Math.max(1, Math.min(179, fov));
        yield* tween(time, (value: number) => {
            const t = ease(value);
            ref.fov = start + (target - start) * t;
            ref.updateProjectionMatrix();
        });
        return;
    }

    zoomget() {
        return this.object.fov;
    }

    *zoomin(offset: number, time: number = 1, ease = easeInOutCubic) {
        const current = this.zoomget();
        yield* this.zoom(current - offset, time, ease);
    }

    *zoomout(offset: number, time: number = 1, ease = easeInOutCubic) {
        const current = this.zoomget();
        yield* this.zoom(current + offset, time, ease);
    }

    // Orbits the camera around a center point on the XZ plane (Y-up),
    // keeping the camera's height (Y) constant.
    *orbit(lap_time = 5, angle_offset = Math.PI * 2, center?: Vector3) {
        const cam = this.object;

        const fov = this.zoomget();

        // Freeze start
        const pos0 = this.positionget().clone();

        // Determine orbit center: prefer explicit param -> last look target -> origin
        const remembered: Vector3 | undefined = this.looktargetget();
        const ctr = (center?.clone() ?? remembered?.clone() ?? new Vector3(0, 0, 0));

        // Relative start vector (from center to camera)
        const rel0 = pos0.clone().sub(ctr);
        const rTot = rel0.length();
        if (rTot === 0) return;

        // Y-up: azimuth around Y (XZ plane), keep Y fixed
        const rXZ = Math.hypot(rel0.x, rel0.z);
        const y0 = rel0.y;
        const theta0 = Math.atan2(rel0.z, rel0.x);

        // Positive duration; signed angle for direction
        const duration = lap_time * Math.abs(angle_offset) / (2 * Math.PI);

        // Pin exact start
        cam.position.copy(pos0);
        cam.lookAt(ctr);

        yield* tween(duration, (u: number) => {
            const t = u <= 0 ? 0 : u >= 1 ? 1 : easeInOutCubic(u);
            const theta = theta0 + angle_offset * t;

            let fov_offset = 0;
            let fov_ampltiude = 5;
            if (u <= 0.5){
                fov_offset = -easeInSine(u*2) * fov_ampltiude;
            }else{
                fov_offset = -fov_ampltiude  + easeOutSine(u*2 - 1) * fov_ampltiude;
            }

            const newPos = new Vector3(
                ctr.x + rXZ * Math.cos(theta),
                ctr.y + y0,
                ctr.z + rXZ * Math.sin(theta)
            );

            cam.position.copy(newPos);
            cam.fov = fov + fov_offset;
            cam.lookAt(ctr);
            cam.updateProjectionMatrix()
        });
    }

    

}