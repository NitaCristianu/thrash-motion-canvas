import { Vector3 } from 'three';

export type PossibleVector3 = Vector3 | number | [number, number, number];

export function getVector3(x: PossibleVector3): Vector3 {
  if (typeof x === 'number') return new Vector3(x, x, x);
  if (x instanceof Vector3) return x;
  if (Array.isArray(x) && x.length === 3) return new Vector3(x[0], x[1], x[2]);
  return new Vector3();
}

