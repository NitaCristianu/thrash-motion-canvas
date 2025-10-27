import {
    Scene,
    PerspectiveCamera,
    Mesh,
    BoxGeometry,
    MeshStandardMaterial,
    MeshBasicMaterial,
    Material,
    Color,
    Matrix4,
    Object3D
} from "three";

export type sceneJSON = Object | any;

// Minimal importer for Three.js editor JSON.
// Supports: BoxGeometry, MeshStandardMaterial, PerspectiveCamera.
// Ensures: if a camera exists, it is added as the first child of the returned Scene.
export default function (json: sceneJSON) {

    const scene = new Scene();

    const sceneBlock = json?.scene ?? json;
    if (!sceneBlock) return scene;

    const geomMap = new Map<string, BoxGeometry>();
    const matMap = new Map<string, Material>();

    const toColor = (value: any) => {
        if (typeof value === 'number') return new Color(value);
        if (Array.isArray(value)) return new Color().fromArray(value);
        return new Color(0xffffff);
    };

    // Build geometries (BoxGeometry only)
    if (Array.isArray(sceneBlock.geometries)) {
        for (const g of sceneBlock.geometries) {
            if (!g?.uuid || !g?.type) continue;
            if (g.type === 'BoxGeometry') {
                const width = g.width ?? 1;
                const height = g.height ?? 1;
                const depth = g.depth ?? 1;
                const ws = g.widthSegments ?? 1;
                const hs = g.heightSegments ?? 1;
                const ds = g.depthSegments ?? 1;
                geomMap.set(
                    g.uuid,
                    new BoxGeometry(width, height, depth, ws, hs, ds)
                );
            }
        }
    }

    // Build materials (basic MeshStandardMaterial and MeshBasicMaterial subset)
    if (Array.isArray(sceneBlock.materials)) {
        for (const m of sceneBlock.materials) {
            if (!m?.uuid || !m?.type) continue;
            if (m.type === 'MeshStandardMaterial') {
                const mat = new MeshStandardMaterial({
                    color: toColor(m.color),
                    roughness: typeof m.roughness === 'number' ? m.roughness : 1,
                    metalness: typeof m.metalness === 'number' ? m.metalness : 0,
                    emissive: m.emissive != null ? toColor(m.emissive) : new Color(0x000000),
                });
                if (typeof m.opacity === 'number') mat.opacity = m.opacity;
                if (typeof m.transparent === 'boolean') mat.transparent = m.transparent;
                matMap.set(m.uuid, mat);
            } else if (m.type === 'MeshBasicMaterial') {
                const mat = new MeshBasicMaterial({
                    color: toColor(m.color),
                    wireframe: !!m.wireframe,
                });
                if (typeof m.opacity === 'number') mat.opacity = m.opacity;
                if (typeof m.transparent === 'boolean') mat.transparent = m.transparent;
                matMap.set(m.uuid, mat);
            }
        }
    }

    const applyMatrixIfPresent = (target: Object3D, node: any) => {
        if (Array.isArray(node?.matrix) && node.matrix.length === 16) {
            const m = new Matrix4();
            m.fromArray(node.matrix);
            // Decompose matrix into TRS since three updates from position/quaternion/scale.
            m.decompose(target.position, target.quaternion, target.scale);
        }
    };

    const buildCamera = (node: any): PerspectiveCamera => {
        const fov = node?.fov ?? 50;
        const aspect = node?.aspect ?? 1;
        const near = node?.near ?? 0.1;
        const far = node?.far ?? 2000;
        const cam = new PerspectiveCamera(fov, aspect, near, far);
        cam.name = node?.name ?? 'Camera';
        applyMatrixIfPresent(cam, node);
        return cam;
    };

    const buildObject = (node: any): Object3D | null => {
        if (!node || typeof node !== 'object') return null;
        const t = node.type;

        if (t === 'Mesh') {
            const geom = geomMap.get(node.geometry);
            // Only support meshes whose geometry we can build (e.g., BoxGeometry).
            if (!geom) return null;
            const mat = matMap.get(node.material) ?? new MeshStandardMaterial({ color: 0xffffff });
            const mesh = new Mesh(geom, mat);
            mesh.name = node.name ?? 'Mesh';
            applyMatrixIfPresent(mesh, node);
            if (Array.isArray(node.children)) {
                for (const c of node.children) {
                    const child = buildObject(c);
                    if (child) mesh.add(child);
                }
            }
            return mesh;
        }

        if (t === 'PerspectiveCamera') {
            // Cameras are handled at the root scene children level; skip here.
            return null;
        }

        // Generic container/group or unsupported types: recurse into children if any.
        const container = new Object3D();
        container.name = node.name ?? (t || 'Object3D');
        applyMatrixIfPresent(container, node);
        if (Array.isArray(node.children)) {
            for (const c of node.children) {
                const child = buildObject(c);
                if (child) container.add(child);
            }
        }
        return container;
    };

    // Apply root scene transform if present
    const root = sceneBlock.object;
    if (root && root.type === 'Scene') {
        applyMatrixIfPresent(scene, root);
    }

    // Only consider cameras found within the scene object's children
    let camera: PerspectiveCamera | undefined;

    // Build children from the scene graph
    const children: Object3D[] = [];
    if (root && Array.isArray(root.children)) {
        for (const childNode of root.children) {
            if (childNode?.type === 'PerspectiveCamera') {
                if (!camera) {
                    camera = buildCamera(childNode);
                }
                // Skip adding additional cameras as regular children
                continue;
            }
            const obj = buildObject(childNode);
            if (obj) children.push(obj);
        }
    }

    // Ensure camera (if any) is the first child
    if (camera) scene.add(camera);
    for (const obj of children) scene.add(obj);

    return scene;
}
