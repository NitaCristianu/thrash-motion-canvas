import { easeInOutCubic, tween, useLogger } from "@motion-canvas/core";
import { Object3D, PerspectiveCamera, Vector3 } from "three";

export type PossibleVector3 = Vector3 | number | [number, number, number];
export function getVector3(x: PossibleVector3): Vector3 {
    if (typeof x == "number") return new Vector3(x, x, x);
    if (typeof x == 'object' && x instanceof Vector3) return x;
    if (Array.isArray(x) && x.length == 3) return new Vector3(x[0], x[1], x[2]);
    return new Vector3();
}


export default class ObjectWrapper<T extends Object3D> {

    public object: T;

    constructor(object: T) {
        this.object = object;
    }

    // Move along world axes by a scalar amount
    *positionup(amount: number, time: number = 0.33, ease = easeInOutCubic) {
        const target = this.positionget().add(new Vector3(0, 1, 0).multiplyScalar(amount));
        yield* this.position(target, time, ease);
    }

    *positiondown(amount: number, time: number = 0.33, ease = easeInOutCubic) {
        const target = this.positionget().add(new Vector3(0, -1, 0).multiplyScalar(amount));
        yield* this.position(target, time, ease);
    }

    *positionright(amount: number, time: number = 0.33, ease = easeInOutCubic) {
        const target = this.positionget().add(new Vector3(1, 0, 0).multiplyScalar(amount));
        yield* this.position(target, time, ease);
    }

    *positionleft(amount: number, time: number = 0.33, ease = easeInOutCubic) {
        const target = this.positionget().add(new Vector3(-1, 0, 0).multiplyScalar(amount));
        yield* this.position(target, time, ease);
    }

    *positionforward(amount: number, time: number = 0.33, ease = easeInOutCubic) {
        // World-forward is along -Z in three.js conventions
        const target = this.positionget().add(new Vector3(0, 0, -1).multiplyScalar(amount));
        yield* this.position(target, time, ease);
    }

    *positionback(amount: number, time: number = 0.33, ease = easeInOutCubic) {
        const target = this.positionget().add(new Vector3(0, 0, 1).multiplyScalar(amount));
        yield* this.position(target, time, ease);
    }

    *position(next: PossibleVector3, time: number = 0.33, ease = easeInOutCubic) {
        const start = this.object.position.clone();
        const target = getVector3(next).clone();
        yield* tween(time, (value: number) => {
            const t = ease(value);
            this.object.position.lerpVectors(start, target, t);
        });
    }

    positionget() { return this.object.position.clone() }
    *positionadd(offset: PossibleVector3, time: number = 0.33, ease = easeInOutCubic) {
        const off = getVector3(offset);
        yield* this.position(this.positionget().add(off), time, ease);
    }
    *positionsub(offset: PossibleVector3, time: number = 0.33, ease = easeInOutCubic) {
        const off = getVector3(offset);
        yield* this.position(this.positionget().clone().sub(off), time, ease);
    }

    // Rotate to face a point or an Object3D's current world position
    *lookat(target: PossibleVector3 | Object3D, time: number = 0.33, ease = easeInOutCubic) {
        // Capture start orientation
        const startQuat = this.object.quaternion.clone();

        // Resolve target world position
        const targetWorld = new Vector3();
        if (target instanceof Object3D) {
            target.updateMatrixWorld();
            target.getWorldPosition(targetWorld);
        } else {
            // Allow Vector3, number, or tuple via PossibleVector3
            targetWorld.copy(getVector3(target));
        }

        // Compute end orientation using a temporary lookAt and restore
        this.object.updateMatrixWorld();
        const originalQuat = this.object.quaternion.clone();
        this.object.lookAt(targetWorld);
        const endQuat = this.object.quaternion.clone();
        this.object.quaternion.copy(originalQuat);

        yield* tween(time, (value: number) => {
            const t = ease(value);
            this.object.quaternion.slerpQuaternions(startQuat, endQuat, t);
        });
    }

    // Get current look direction (world space). Returns a normalized vector.
    lookatget() {
        return this.object.getWorldDirection(new Vector3());
    }

    // Absolute scaling to a target scale vector
    *scale(next: PossibleVector3, time: number = 0.33, ease = easeInOutCubic) {
        const start = this.object.scale.clone();
        const target = getVector3(next).clone();
        yield* tween(time, (value: number) => {
            const t = ease(value);
            this.object.scale.lerpVectors(start, target, t);
        });
    }

    scaleget() { return this.object.scale.clone(); }

    // Multiplicative scaling by factors (per-axis)
    *scalemul(factors: PossibleVector3, time: number = 0.33, ease = easeInOutCubic) {
        const f = getVector3(factors);
        const target = this.scaleget().clone().multiply(f);
        yield* this.scale(target, time, ease);
    }

    // Divisive scaling by factors (per-axis)
    *scalediv(factors: PossibleVector3, time: number = 0.33, ease = easeInOutCubic) {
        const f = getVector3(factors);
        const target = this.scaleget().clone().divide(f);
        yield* this.scale(target, time, ease);
    }

    *select(ammount: number, time: number = 0.66, ease1 = easeInOutCubic, ease2 = easeInOutCubic) {
        yield* this.scalemul(ammount, time / 2, ease1);
        yield* this.scalemul(ammount, time / 2, ease2);
    }

    *zoom(fov: number, time: number = 1, ease = easeInOutCubic) {
        const ref = this.object;
        if (ref instanceof PerspectiveCamera) {
            const start = ref.fov;
            const target = Math.max(1, Math.min(179, fov));
            yield* tween(time, (value: number) => {
                const t = ease(value);
                ref.fov = start + (target - start) * t;
                ref.updateProjectionMatrix();
            });
            return;
        }
        useLogger().error("Zoom only works for perspective camera wrappers");
    }

    zoomget() {
        if (this.object instanceof PerspectiveCamera)
            return this.object.fov;
        useLogger().error("Zoom doesn't exist in non perspective camera wrapper. [zoomget]");
        return undefined;
    }

    *zoomin(offset: number, time: number = 1, ease = easeInOutCubic) {
        const current = this.zoomget();
        if (typeof current === 'number') {
            yield* this.zoom(current + offset, time, ease);
        }
    }

    *zoomout(offset: number, time: number = 1, ease = easeInOutCubic) {
        const current = this.zoomget();
        if (typeof current === 'number') {
            yield* this.zoom(current - offset, time, ease);
        }
    }


}
