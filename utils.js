function lerp(A, B, t) {
    return A + (B - A) * t;
}

function getIntersection(A, B, C, D) {
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: lerp(A.x, B.x, t),
                y: lerp(A.y, B.y, t),
                offset: t,
            };
        }
    }

    return null;
}

/**
 * Test whether two convex polygons intersect using edge-intersection.
 * Returns true on first detected intersection (early-exit) to avoid
 * testing all O(n*m) edge pairs when a collision is found early.
 */
function polysIntersect(poly1, poly2) {
    const n1 = poly1.length;
    const n2 = poly2.length;
    for (let i = 0; i < n1; i++) {
        const a0 = poly1[i];
        const a1 = poly1[(i + 1) % n1];
        for (let j = 0; j < n2; j++) {
            if (getIntersection(a0, a1, poly2[j], poly2[(j + 1) % n2])) {
                return true;
            }
        }
    }
    return false;
}

function getRGBA(value) {
    const alpha = Math.abs(value);
    const R = value < 0 ? 0 : 255;
    const G = R;
    const B = value > 0 ? 0 : 255;
    return "rgba(" + R + "," + G + "," + B + "," + alpha + ")";
}
