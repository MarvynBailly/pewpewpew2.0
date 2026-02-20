// ── Physics Engine ───────────────────────────────────────
// Velocity-based movement with acceleration and drag.
// Gives everything a floaty, "spacy" feel.

const Physics = {
    // Apply thrust in a direction (call while a key is held)
    applyThrust(entity, ax, ay, dt) {
        entity.vx += ax * (dt / 1000);
        entity.vy += ay * (dt / 1000);
    },

    // Update an entity's position using its velocity, then apply drag
    update(entity, dt) {
        const seconds = dt / 1000;

        // Move by velocity
        entity.x += entity.vx * seconds;
        entity.y += entity.vy * seconds;

        // Apply drag (multiplicative so it feels smooth)
        // drag of 0.98 at 60fps ≈ losing ~2% speed per frame
        const frameDrag = Math.pow(entity.drag, seconds * 60);
        entity.vx *= frameDrag;
        entity.vy *= frameDrag;

        // Kill tiny velocities so the ship actually stops
        if (Math.abs(entity.vx) < 0.5) entity.vx = 0;
        if (Math.abs(entity.vy) < 0.5) entity.vy = 0;

        // Clamp to max speed
        const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
        if (speed > entity.maxSpeed) {
            entity.vx = (entity.vx / speed) * entity.maxSpeed;
            entity.vy = (entity.vy / speed) * entity.maxSpeed;
        }
    },

    // Keep entity within a rectangular boundary (bounces off edges)
    clampToBounds(entity, halfW, halfH, boundsW, boundsH) {
        if (entity.x < halfW) {
            entity.x = halfW;
            entity.vx *= -0.3; // soft bounce
        }
        if (entity.x > boundsW - halfW) {
            entity.x = boundsW - halfW;
            entity.vx *= -0.3;
        }
        if (entity.y < halfH) {
            entity.y = halfH;
            entity.vy *= -0.3;
        }
        if (entity.y > boundsH - halfH) {
            entity.y = boundsH - halfH;
            entity.vy *= -0.3;
        }
    },

    // Helper: set up physics properties on any entity
    initBody(entity, opts = {}) {
        entity.vx = opts.vx || 0;
        entity.vy = opts.vy || 0;
        entity.drag = opts.drag ?? 0.98;         // how quickly it slows (lower = more drag)
        entity.maxSpeed = opts.maxSpeed || 400;   // pixels per second
        entity.accel = opts.accel || 800;         // pixels per second²
    },
};
