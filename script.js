/**
 * Blob Sallad - Modernized Script
 *
 * This script has been refactored to use modern JavaScript (ES6+) standards,
 * including classes, let/const, and arrow functions. It removes the dependency
 * on jQuery for DOM manipulation and event handling.
 */

// Global state and configuration
let windowFocus = true;
let isStopped = false;
let canvas, ctx;
let environment, blobCollection;
let gravity = new Vector(0, 10);
const width = 600;
const height = 400;
const scaleFactor = 200;

// Mouse interaction variables
let savedMouseCoords = null;
let selectOffset = null;

/**
 * A 2D Vector class for physics calculations.
 */
class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(other) {
        this.x = other.x;
        this.y = other.y;
    }

    add(other) {
        this.x += other.x;
        this.y += other.y;
    }

    sub(other) {
        this.x -= other.x;
        this.y -= other.y;
    }

    scale(factor) {
        this.x *= factor;
        this.y *= factor;
    }

    dotProd(other) {
        return this.x * other.x + this.y * other.y;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
}

/**
 * Defines the simulation boundaries.
 */
class Environment {
    constructor(left, top, width, height) {
        this.left = left;
        this.top = top;
        this.right = left + width;
        this.bottom = top + height;
    }

    // Check and resolve collisions with the environment walls
    handleCollision(pointMass) {
        let collided = false;
        if (pointMass.cur.x < this.left) {
            pointMass.cur.x = this.left;
            collided = true;
        } else if (pointMass.cur.x > this.right) {
            pointMass.cur.x = this.right;
            collided = true;
        }
        if (pointMass.cur.y < this.top) {
            pointMass.cur.y = this.top;
            collided = true;
        } else if (pointMass.cur.y > this.bottom) {
            pointMass.cur.y = this.bottom;
            collided = true;
        }
        return collided;
    }
}

/**
 * Represents a single point mass in the physics simulation.
 */
class PointMass {
    constructor(x, y, mass) {
        this.cur = new Vector(x, y);
        this.prev = new Vector(x, y);
        this.mass = mass;
        this.force = new Vector(0, 0);
        this.friction = 0.01;
    }

    // Update position based on Verlet integration
    move(deltaTime) {
        const dtSquared = deltaTime * deltaTime;
        const acceleration = new Vector(this.force.x / this.mass, this.force.y / this.mass);

        const newX = (2 - this.friction) * this.cur.x - (1 - this.friction) * this.prev.x + acceleration.x * dtSquared;
        const newY = (2 - this.friction) * this.cur.y - (1 - this.friction) * this.prev.y + acceleration.y * dtSquared;

        this.prev.set(this.cur);
        this.cur.x = newX;
        this.cur.y = newY;
    }

    getVelocity() {
        const dX = this.cur.x - this.prev.x;
        const dY = this.cur.y - this.prev.y;
        return dX * dX + dY * dY;
    }

    draw(ctx, scale) {
        ctx.lineWidth = 2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.cur.x * scale, this.cur.y * scale, 4, 0, 2 * Math.PI, true);
        ctx.fill();
    }
}

/**
 * A constraint that keeps two PointMass objects a fixed distance apart.
 */
class Stick {
    constructor(pointMassA, pointMassB) {
        this.pointMassA = pointMassA;
        this.pointMassB = pointMassB;
        const delta = new Vector(pointMassA.cur.x - pointMassB.cur.x, pointMassA.cur.y - pointMassB.cur.y);
        this.length = delta.length();
        this.lengthSquared = this.length * this.length;
    }

    scale(factor) {
        this.length *= factor;
        this.lengthSquared = this.length * this.length;
    }

    // Satisfy the constraint
    satisfy() {
        const delta = new Vector(this.pointMassB.cur.x - this.pointMassA.cur.x, this.pointMassB.cur.y - this.pointMassA.cur.y);
        const dot = delta.dotProd(delta);
        const scaleFactor = this.lengthSquared / (dot + this.lengthSquared) - 0.5;
        delta.scale(scaleFactor);

        this.pointMassA.cur.sub(delta);
        this.pointMassB.cur.add(delta);
    }
}

/**
 * A flexible constraint between two PointMass objects.
 */
class Joint {
    constructor(pointA, pointB, shortConst, longConst) {
        this.pointA = pointA;
        this.pointB = pointB;
        const delta = new Vector(pointB.cur.x - pointA.cur.x, pointB.cur.y - pointA.cur.y);
        const initialLength = delta.length();
        this.shortConst = initialLength * shortConst;
        this.longConst = initialLength * longConst;
        this.scSquared = this.shortConst * this.shortConst;
        this.lcSquared = this.longConst * this.longConst;
    }

    scale(factor) {
        this.shortConst *= factor;
        this.longConst *= factor;
        this.scSquared = this.shortConst * this.shortConst;
        this.lcSquared = this.longConst * this.longConst;
    }

    setDist(shortDist, longDist) {
        this.shortConst = shortDist;
        this.longConst = longDist;
        this.scSquared = this.shortConst * this.shortConst;
        this.lcSquared = this.longConst * this.longConst;
    }

    satisfy() {
        const delta = new Vector(this.pointB.cur.x - this.pointA.cur.x, this.pointB.cur.y - this.pointA.cur.y);
        const k = delta.dotProd(delta);

        if (this.shortConst !== 0 && k < this.scSquared) {
            const l = this.scSquared / (k + this.scSquared) - 0.5;
            delta.scale(l);
            this.pointA.cur.sub(delta);
            this.pointB.cur.add(delta);
        } else if (this.longConst !== 0 && k > this.lcSquared) {
            const l = this.lcSquared / (k + this.lcSquared) - 0.5;
            delta.scale(l);
            this.pointA.cur.sub(delta);
            this.pointB.cur.add(delta);
        }
    }
}

/**
 * Represents a single Blob creature.
 */
class Blob {
    constructor(x, y, radius, numPoints = 8) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.pointMasses = [];
        this.sticks = [];
        this.joints = [];
        this.selected = false;
        this.face = { eyeStyle: 1, faceStyle: 1 };

        // Create outer points
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const px = Math.cos(angle) * radius + x;
            const py = Math.sin(angle) * radius + y;
            this.pointMasses.push(new PointMass(px, py, 1));
        }

        // Create center point
        this.middlePointMass = new PointMass(x, y, 1);

        // Heavier points for orientation
        this.pointMasses[0].mass = 4;
        this.pointMasses[1].mass = 4;

        // Create sticks connecting outer points
        for (let i = 0; i < numPoints; i++) {
            this.sticks.push(new Stick(this.pointMasses[i], this.pointMasses[(i + 1) % numPoints]));
        }

        // Create joints for structure
        const m = 0.95, n = 1.05;
        for (let i = 0; i < numPoints; i++) {
            this.joints.push(new Joint(this.pointMasses[i], this.pointMasses[(i + numPoints / 2 + 1) % numPoints], m, n));
            this.joints.push(new Joint(this.pointMasses[i], this.middlePointMass, 0.9 * n, 1.1 * m));
        }
    }

    addBlobConnection(otherBlob) {
        const newJoint = new Joint(this.middlePointMass, otherBlob.middlePointMass, 0, 0);
        const totalRadius = this.radius + otherBlob.radius;
        newJoint.setDist(0.95 * totalRadius, 0);
        this.joints.push(newJoint);
    }

    getPointMass(index) {
        return this.pointMasses[(index + this.pointMasses.length) % this.pointMasses.length];
    }

    getAllPointMasses() {
        return [...this.pointMasses, this.middlePointMass];
    }

    scale(factor) {
        this.radius *= factor;
        this.joints.forEach(j => j.scale(factor));
        this.sticks.forEach(s => s.scale(factor));
    }

    move(deltaTime) {
        this.getAllPointMasses().forEach(p => p.move(deltaTime));
    }

    satisfyConstraints(environment) {
        for (let i = 0; i < 4; i++) { // Iterations for stability
            this.getAllPointMasses().forEach(p => {
                p.friction = environment.handleCollision(p) ? 0.75 : 0.01;
            });
            this.sticks.forEach(s => s.satisfy());
            this.joints.forEach(j => j.satisfy());
        }
    }

    setForce(force) {
        this.getAllPointMasses().forEach(p => p.force.set(force));
    }

    addForce(force) {
        this.getAllPointMasses().forEach(p => p.force.add(force));
        // Add extra force for directional control
        this.pointMasses[0].force.add(force);
        this.pointMasses[0].force.add(force);
    }

    moveTo(x, y) {
        const delta = new Vector(x - this.middlePointMass.cur.x, y - this.middlePointMass.cur.y);
        this.getAllPointMasses().forEach(p => {
            p.cur.add(delta);
        });
    }

    // --- Drawing Methods ---

    draw(ctx, scale) {
        // Draw body
        ctx.strokeStyle = '#000';
        ctx.fillStyle = this.selected ? '#FFCCCC' : '#FFF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(this.pointMasses[0].cur.x * scale, this.pointMasses[0].cur.y * scale);

        for (let i = 0; i < this.pointMasses.length; i++) {
            const pPrev = this.getPointMass(i - 1).cur;
            const pCurr = this.pointMasses[i].cur;
            const pNext = this.getPointMass(i + 1).cur;
            const pAfterNext = this.getPointMass(i + 2).cur;

            const cp1x = (pCurr.x + pNext.x * 0.5) + (pCurr.x - pPrev.x + pNext.x - pAfterNext.x) * 0.16;
            const cp1y = (pCurr.y + pNext.y * 0.5) + (pCurr.y - pPrev.y + pNext.y - pAfterNext.y) * 0.16;
            ctx.bezierCurveTo(cp1x * scale, cp1y * scale, pNext.x * scale, pNext.y * scale, pNext.x * scale, pNext.y * scale);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        // Draw face
        ctx.save();
        ctx.translate(this.middlePointMass.cur.x * scale, (this.middlePointMass.cur.y - 0.35 * this.radius) * scale);
        const topPoint = this.pointMasses[0].cur;
        const centerPoint = this.middlePointMass.cur;
        const angle = Math.atan2(topPoint.y - centerPoint.y, topPoint.x - centerPoint.x) + Math.PI / 2;
        ctx.rotate(angle);
        this.drawFace(ctx, scale);
        ctx.restore();
    }

    drawFace(ctx, scale) {
        const r = this.radius * scale;

        // Animate face expressions
        if (this.face.faceStyle === 1 && Math.random() < 0.05) this.face.faceStyle = 2;
        else if (this.face.faceStyle === 2 && Math.random() < 0.1) this.face.faceStyle = 1;

        if (this.face.eyeStyle === 1 && Math.random() < 0.025) this.face.eyeStyle = 2;
        else if (this.face.eyeStyle === 2 && Math.random() < 0.3) this.face.eyeStyle = 1;

        // Draw face based on velocity
        if (this.middlePointMass.getVelocity() > 0.004) {
            this.drawOohFace(ctx, r);
        } else {
            this.face.faceStyle === 1 ? this.drawHappyFace1(ctx, r) : this.drawHappyFace2(ctx, r);
            this.face.eyeStyle === 1 ? this.drawHappyEyes1(ctx, r) : this.drawHappyEyes2(ctx, r);
        }
    }

    drawHappyFace1(ctx, r) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, 0.25 * r, 0, Math.PI, false);
        ctx.stroke();
    }

    drawHappyFace2(ctx, r) {
        ctx.lineWidth = 2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, 0.25 * r, 0, Math.PI, false);
        ctx.fill();
    }

    drawHappyEyes1(ctx, r) {
        ctx.lineWidth = 1;
        ctx.fillStyle = '#FFF';
        ctx.strokeStyle = '#000';
        [-0.15, 0.15].forEach(xOffset => {
            ctx.beginPath();
            ctx.arc(xOffset * r, -0.2 * r, 0.12 * r, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.stroke();
        });
        ctx.fillStyle = '#000';
        [-0.15, 0.15].forEach(xOffset => {
            ctx.beginPath();
            ctx.arc(xOffset * r, -0.17 * r, 0.06 * r, 0, 2 * Math.PI, false);
            ctx.fill();
        });
    }

    drawHappyEyes2(ctx, r) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(-0.25 * r, -0.2 * r);
        ctx.lineTo(-0.05 * r, -0.2 * r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.25 * r, -0.2 * r);
        ctx.lineTo(0.05 * r, -0.2 * r);
        ctx.stroke();
    }

    drawOohFace(ctx, r) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0.1 * r, 0.25 * r, 0, 2 * Math.PI, false);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-0.25 * r, -0.3 * r);
        ctx.lineTo(-0.05 * r, -0.2 * r);
        ctx.lineTo(-0.25 * r, -0.1 * r);
        ctx.moveTo(0.25 * r, -0.3 * r);
        ctx.lineTo(0.05 * r, -0.2 * r);
        ctx.lineTo(0.25 * r, -0.1 * r);
        ctx.stroke();
    }
}


/**
 * Manages the collection of all blobs in the simulation.
 */
class BlobCollection {
    constructor(x, y, maxBlobs) {
        this.blobs = [new Blob(x, y, 0.4, 8)];
        this.maxNum = maxBlobs;
        this.selectedBlob = null;
    }

    get activeBlobs() {
        return this.blobs.filter(b => b !== null);
    }

    split() {
        if (this.activeBlobs.length >= this.maxNum) return;

        const largestBlob = this.activeBlobs.reduce((largest, current) =>
            (current.radius > largest.radius) ? current : largest, this.blobs[0]);

        largestBlob.scale(0.75);
        const newBlob = new Blob(largestBlob.middlePointMass.cur.x, largestBlob.middlePointMass.cur.y, largestBlob.radius, 8);

        this.activeBlobs.forEach(blob => {
            blob.addBlobConnection(newBlob);
            newBlob.addBlobConnection(blob);
        });
        this.blobs.push(newBlob);
    }

    join() {
        if (this.activeBlobs.length <= 1) return;

        const smallestBlob = this.activeBlobs.reduce((smallest, current) =>
            (current.radius < smallest.radius) ? current : smallest, this.activeBlobs[0]);
        const smallestIndex = this.blobs.indexOf(smallestBlob);

        const closestBlob = this.activeBlobs
            .filter(b => b !== smallestBlob)
            .reduce((closest, current) => {
                const distToCurrent = this.distanceSquared(smallestBlob, current);
                const distToClosest = this.distanceSquared(smallestBlob, closest);
                return distToCurrent < distToClosest ? current : closest;
            });

        const r1 = smallestBlob.radius;
        const r2 = closestBlob.radius;
        const newRadius = Math.sqrt(r1 * r1 + r2 * r2);
        closestBlob.scale(0.945 * newRadius / r2);

        this.blobs[smallestIndex] = null;
    }

    distanceSquared(blobA, blobB) {
        const dx = blobA.middlePointMass.cur.x - blobB.middlePointMass.cur.x;
        const dy = blobA.middlePointMass.cur.y - blobB.middlePointMass.cur.y;
        return dx * dx + dy * dy;
    }

    selectBlob(x, y) {
        if (this.selectedBlob) return null;

        for (const blob of this.activeBlobs) {
            const center = blob.middlePointMass.cur;
            const distSq = (x - center.x) ** 2 + (y - center.y) ** 2;
            if (distSq < (0.5 * blob.radius) ** 2) {
                this.selectedBlob = blob;
                blob.selected = true;
                return { x: x - center.x, y: y - center.y };
            }
        }
        return null;
    }

    unselectBlob() {
        if (this.selectedBlob) {
            this.selectedBlob.selected = false;
            this.selectedBlob = null;
        }
    }

    moveSelectedBlobTo(x, y) {
        if (this.selectedBlob) {
            this.selectedBlob.moveTo(x, y);
        }
    }

    update(deltaTime, environment) {
        if (savedMouseCoords && selectOffset) {
            this.moveSelectedBlobTo(savedMouseCoords.x - selectOffset.x, savedMouseCoords.y - selectOffset.y);
        }

        this.activeBlobs.forEach(blob => {
            if (blob !== this.selectedBlob) {
                blob.setForce(gravity);
            } else {
                blob.setForce(new Vector(0, 0));
            }
            blob.move(deltaTime);
            blob.satisfyConstraints(environment);
        });
    }

    addForce(force) {
        this.activeBlobs.forEach(blob => {
            if (blob !== this.selectedBlob) {
                const randomForce = new Vector(
                    force.x * (0.75 * Math.random() + 0.25),
                    force.y * (0.75 * Math.random() + 0.25)
                );
                blob.addForce(randomForce);
            }
        });
    }

    draw(ctx, scale) {
        this.activeBlobs.forEach(blob => blob.draw(ctx, scale));
    }
}

/**
 * Main simulation loop.
 */
function gameLoop() {
    if (isStopped) return;

    // Update physics
    blobCollection.update(0.05, environment);

    // Draw frame
    ctx.clearRect(0, 0, width, height);
    blobCollection.draw(ctx, scaleFactor);

    requestAnimationFrame(gameLoop);
}


/**
 * Initializes the simulation and event listeners.
 */
function init() {
    canvas = document.getElementById('blob');
    if (!canvas.getContext) {
        alert('Sorry, your browser does not support the HTML5 canvas.');
        return;
    }
    ctx = canvas.getContext('2d');

    // Create environment and blob collection
    environment = new Environment(0.2, 0.2, 2.6, 1.6);
    blobCollection = new BlobCollection(1, 1, 200);

    // Setup event listeners
    setupEventListeners();

    // Start the game loop
    isStopped = false;
    gameLoop();
}

/**
 * Sets up all necessary event listeners for user interaction.
 */
function setupEventListeners() {
    const clickToPlay = document.getElementById('clickToPlay');

    // Window focus handling
    window.addEventListener('focus', () => {
        windowFocus = true;
        clickToPlay.style.display = 'none';
    });
    window.addEventListener('blur', () => {
        windowFocus = false;
        clickToPlay.style.display = 'block';
    });
    document.body.addEventListener('click', () => {
        clickToPlay.style.display = 'none';
    });

    // Control buttons
    document.getElementById('splitBlob').addEventListener('click', () => blobCollection.split());
    document.getElementById('joinBlob').addEventListener('click', () => blobCollection.join());
    document.getElementById('gravityBlob').addEventListener('click', toggleGravity);
    document.getElementById('leftArrow').addEventListener('click', () => blobCollection.addForce(new Vector(-120, 0)));
    document.getElementById('rightArrow').addEventListener('click', () => blobCollection.addForce(new Vector(120, 0)));
    document.getElementById('upArrow').addEventListener('click', () => blobCollection.addForce(new Vector(0, -120)));
    document.getElementById('downArrow').addEventListener('click', () => blobCollection.addForce(new Vector(0, 120)));

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'h': case 'H': blobCollection.split(); break;
            case 'j': case 'J': blobCollection.join(); break;
            case 'g': case 'G': toggleGravity(); break;
            case 'ArrowLeft': blobCollection.addForce(new Vector(-50, 0)); break;
            case 'ArrowRight': blobCollection.addForce(new Vector(50, 0)); break;
            case 'ArrowUp': blobCollection.addForce(new Vector(0, -50)); break;
            case 'ArrowDown': blobCollection.addForce(new Vector(0, 50)); break;
        }
    });

    // Mouse controls
    canvas.addEventListener('mousedown', (e) => {
        if (isStopped) return;
        const coords = getMouseCoords(e);
        if (coords) {
            selectOffset = blobCollection.selectBlob(coords.x, coords.y);
        }
    });

    document.addEventListener('mouseup', () => {
        blobCollection.unselectBlob();
        savedMouseCoords = null;
        selectOffset = null;
    });

    document.addEventListener('mousemove', (e) => {
        if (isStopped || !selectOffset) return;
        const coords = getMouseCoords(e);
        if (coords) {
            blobCollection.moveSelectedBlobTo(coords.x - selectOffset.x, coords.y - selectOffset.y);
            savedMouseCoords = coords;
        }
    });
}

/**
 * Helper to get scaled mouse coordinates relative to the canvas.
 */
function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / scaleFactor,
        y: (e.clientY - rect.top) / scaleFactor
    };
}

/**
 * Toggles gravity on or off.
 */
function toggleGravity() {
    gravity.y = (gravity.y > 0) ? 0 : 10;
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', init);
