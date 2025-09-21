/**
 * Minimal 4D math helpers for projecting game geometry to screen space.
 */

/**
 * Apply 4D rotations in XW, YW, ZW planes.
 * @param {{x:number,y:number,z:number,w:number}} vec
 * @param {{rot4dXW:number,rot4dYW:number,rot4dZW:number}} angles
 */
export function rotate4D(vec, angles) {
    let { x, y, z, w } = vec;

    if (angles.rot4dXW) {
        const cos = Math.cos(angles.rot4dXW);
        const sin = Math.sin(angles.rot4dXW);
        const nx = x * cos - w * sin;
        const nw = x * sin + w * cos;
        x = nx;
        w = nw;
    }

    if (angles.rot4dYW) {
        const cos = Math.cos(angles.rot4dYW);
        const sin = Math.sin(angles.rot4dYW);
        const ny = y * cos - w * sin;
        const nw = y * sin + w * cos;
        y = ny;
        w = nw;
    }

    if (angles.rot4dZW) {
        const cos = Math.cos(angles.rot4dZW);
        const sin = Math.sin(angles.rot4dZW);
        const nz = z * cos - w * sin;
        const nw = z * sin + w * cos;
        z = nz;
        w = nw;
    }

    return { x, y, z, w };
}

/**
 * Simple 4D → 3D projection that blends W into scale.
 * @param {{x:number,y:number,z:number,w:number}} vec
 * @param {number} dimension - effective dimensionality (3-4)
 */
export function project4Dto3D(vec, dimension) {
    const depth = Math.max(0.5, dimension);
    const scale = 1 / (depth + 1 - vec.w * 0.5);
    return {
        x: vec.x * scale,
        y: vec.y * scale,
        z: vec.z * scale
    };
}

/**
 * Project 3D coordinates to 2D normalized screen space (0..1).
 * @param {{x:number,y:number,z:number}} vec3
 * @param {number} aspect
 */
export function project3DtoScreen(vec3, aspect = 1) {
    const perspective = 1 / (1 + Math.max(-0.8, Math.min(0.8, vec3.z)));
    const x = 0.5 + vec3.x * perspective * 0.45 * aspect;
    const y = 0.5 - vec3.y * perspective * 0.45;
    return { x, y };
}

/**
 * Combined helper: rotate + project to screen.
 * @param {object} vec4
 * @param {object} params - expects rot4dXW/YW/ZW and dimension.
 * @param {number} aspect
 */
export function project4DToScreen(vec4, params, aspect = 1) {
    const rotated = rotate4D(vec4, params);
    const vec3 = project4Dto3D(rotated, params.dimension || 3.5);
    return project3DtoScreen(vec3, aspect);
}

/**
 * Compute squared distance between two points in normalized screen space.
 */
export function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

/**
 * Linear interpolation.
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Exponential decay helper.
 */
export function damp(value, target, lambda, dt) {
    return lerp(value, target, 1 - Math.exp(-lambda * dt));
}
