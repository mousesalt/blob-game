// Global variables
var window_focus;
var env, width = 600, height = 400, scaleFactor = 200, blobColl, gravity, stopped;
var savedMouseCoords = null;
var selectOffset = null;

// Focus and blur events for the window
$(window).focus(function() {
    window_focus = true;
    $('#clickToPlay').fadeOut(300);
}).blur(function() {
    window_focus = false;
    $('#clickToPlay').fadeIn(300);
});

// Document ready event
$(document).ready(function() {
    init();

    $('body').click(function() {
        $('#clickToPlay').fadeOut(300);
    });

    // Control button click handlers
    $('#splitBlob').click(function() { blobColl.split(); });
    $('#joinBlob').click(function() { blobColl.join(); });
    $('#gravityBlob').click(function() { toggleGravity(); });
    $('#leftArrow').click(function() { blobColl.addForce(new Vector(-120, 0)); });
    $('#rightArrow').click(function() { blobColl.addForce(new Vector(120, 0)); });
    $('#upArrow').click(function() { blobColl.addForce(new Vector(0, -120)); });
    $('#downArrow').click(function() { blobColl.addForce(new Vector(0, 120)); });
});

// Vector class for 2D physics calculations
function Vector(b, d) {
    this.x = b;
    this.y = d;
    this.equal = function(e) { return this.x == e.getX() && this.y == e.getY() };
    this.getX = function() { return this.x };
    this.getY = function() { return this.y };
    this.setX = function(e) { this.x = e };
    this.setY = function(e) { this.y = e };
    this.addX = function(e) { this.x += e };
    this.addY = function(e) { this.y += e };
    this.set = function(e) { this.x = e.getX(), this.y = e.getY() };
    this.add = function(e) { this.x += e.getX(), this.y += e.getY() };
    this.sub = function(e) { this.x -= e.getX(), this.y -= e.getY() };
    this.dotProd = function(e) { return this.x * e.getX() + this.y * e.getY() };
    this.length = function() { return Math.sqrt(this.x * this.x + this.y * this.y) };
    this.scale = function(e) { this.x *= e, this.y *= e };
    this.toString = function() { return ' X: ' + this.x + ' Y: ' + this.y }
}

// Environment class for boundaries
function Environment(b, d, e, g) {
    this.left = b;
    this.right = b + e;
    this.top = d;
    this.buttom = d + g;
    this.r = new Vector(0, 0);
    this.collision = function(k) {
        var m = !1;
        if (k.getX() < this.left) { k.setX(this.left); m = !0; }
        else if (k.getX() > this.right) { k.setX(this.right); m = !0; }
        if (k.getY() < this.top) { k.setY(this.top); m = !0; }
        else if (k.getY() > this.buttom) { k.setY(this.buttom); m = !0; }
        return m;
    };
    this.draw = function() {};
}

// PointMass class for individual particles
function PointMass(b, d, e) {
    this.cur = new Vector(b, d);
    this.prev = new Vector(b, d);
    this.mass = e;
    this.force = new Vector(0, 0);
    this.result = new Vector(0, 0);
    this.friction = 0.01;
    this.getXPos = function() { return this.cur.getX() };
    this.getYPos = function() { return this.cur.getY() };
    this.getPos = function() { return this.cur };
    this.getXPrevPos = function() { return this.prev.getX() };
    this.getYPrevPos = function() { return this.prev.getY() };
    this.getPrevPos = function() { return this.prev };
    this.addXPos = function(g) { this.cur.addX(g) };
    this.addYPos = function(g) { this.cur.addY(g) };
    this.setForce = function(g) { this.force.set(g) };
    this.addForce = function(g) { this.force.add(g) };
    this.getMass = function() { return this.mass };
    this.setMass = function(g) { this.mass = g };
    this.move = function(g) {
        var k, l, m, n;
        n = g * g;
        l = this.force.getX() / this.mass;
        m = this.cur.getX();
        k = (2 - this.friction) * m - (1 - this.friction) * this.prev.getX() + l * n;
        this.prev.setX(m);
        this.cur.setX(k);
        l = this.force.getY() / this.mass;
        m = this.cur.getY();
        k = (2 - this.friction) * m - (1 - this.friction) * this.prev.getY() + l * n;
        this.prev.setY(m);
        this.cur.setY(k);
    };
    this.setFriction = function(g) { this.friction = g };
    this.getVelocity = function() { var g, k; return g = this.cur.getX() - this.prev.getX(), k = this.cur.getY() - this.prev.getY(), g * g + k * k };
    this.draw = function(g, k) { g.lineWidth = 2, g.fillStyle = '#000000', g.strokeStyle = '#000000', g.beginPath(), g.arc(this.cur.getX() * k, this.cur.getY() * k, 4, 0, 2 * Math.PI, !0), g.fill() }
}

function ConstraintY(b, d, e, g) { this.pointMass = b, this.y = d, this.delta = new Vector(0, 0), this.shortConst = e, this.longConst = g, this.sc = function() { var k; if (k = Math.abs(this.pointMass.getYPos() - this.y), this.delta.setY(-k), 0 != this.shortConst && k < this.shortConst) { var l; l = this.shortConst / k, this.delta.scale(l), b.getPos().sub(this.delta) } else if (0 != this.longConst && k > this.longConst) { var l; l = this.longConst / k, this.delta.scale(l), b.getPos().sub(this.delta) } } }
function Joint(b, d, e, g) { this.pointMassA = b, this.pointMassB = d, this.delta = new Vector(0, 0), this.pointMassAPos = b.getPos(), this.pointMassBPos = d.getPos(), this.delta.set(this.pointMassBPos), this.delta.sub(this.pointMassAPos), this.shortConst = this.delta.length() * e, this.longConst = this.delta.length() * g, this.scSquared = this.shortConst * this.shortConst, this.lcSquared = this.longConst * this.longConst, this.setDist = function(k, l) { this.shortConst = k, this.longConst = l, this.scSquared = this.shortConst * this.shortConst, this.lcSquared = this.longConst * this.longConst }, this.scale = function(k) { this.shortConst *= k, this.longConst *= k, this.scSquared = this.shortConst * this.shortConst, this.lcSquared = this.longConst * this.longConst }, this.sc = function() { this.delta.set(this.pointMassBPos), this.delta.sub(this.pointMassAPos); var k = this.delta.dotProd(this.delta); if (0 != this.shortConst && k < this.scSquared) { var l; l = this.scSquared / (k + this.scSquared) - 0.5, this.delta.scale(l), this.pointMassAPos.sub(this.delta), this.pointMassBPos.add(this.delta) } else if (0 != this.longConst && k > this.lcSquared) { var l; l = this.lcSquared / (k + this.lcSquared) - 0.5, this.delta.scale(l), this.pointMassAPos.sub(this.delta), this.pointMassBPos.add(this.delta) } } }
function Stick(b, d) { this.length = function(g, k) { var l, m; return l = g.getXPos() - k.getXPos(), m = g.getYPos() - k.getYPos(), Math.sqrt(l * l + m * m) }(b, d), this.lengthSquared = this.length * this.length, this.pointMassA = b, this.pointMassB = d, this.delta = new Vector(0, 0), this.getPointMassA = function() { return this.pointMassA }, this.getPointMassB = function() { return this.pointMassB }, this.scale = function(g) { this.length *= g, this.lengthSquared = this.length * this.length }, this.sc = function() { var k, l, m, n; m = this.pointMassA.getPos(), n = this.pointMassB.getPos(), this.delta.set(n), this.delta.sub(m), k = this.delta.dotProd(this.delta), l = this.lengthSquared / (k + this.lengthSquared) - 0.5, this.delta.scale(l), m.sub(this.delta), n.add(this.delta) }, this.setForce = function(g) { this.pointMassA.setForce(g), this.pointMassB.setForce(g) }, this.addForce = function(g) { this.pointMassA.addForce(g), this.pointMassB.addForce(g) }, this.move = function(g) { this.pointMassA.move(g), this.pointMassB.move(g) }, this.draw = function(g, k) { this.pointMassA.draw(g, k), this.pointMassB.draw(g, k), g.lineWidth = 3, g.fillStyle = '#000000', g.strokeStyle = '#000000', g.beginPath(), g.moveTo(this.pointMassA.getXPos() * k, this.pointMassA.getYPos() * k), g.lineTo(this.pointMassB.getXPos() * k, this.pointMassB.getYPos() * k), g.stroke() } }
function Spring(b, d, e, g, k) { this.restLength = b, this.stiffness = d, this.damper = e, this.pointMassA = g, this.pointMassB = k, this.tmp = new Vector(0, 0), this.sc = function(l) { l.collision(this.pointMassA.getPos(), this.pointMassA.getPrevPos()), l.collision(this.pointMassB.getPos(), this.pointMassB.getPrevPos()) }, this.move = function(l) { var m, n, o, q; m = this.pointMassA.getXPos() - this.pointMassB.getXPos(), n = this.pointMassA.getYPos() - this.pointMassB.getYPos(), q = Math.sqrt(m * m + n * n), o = this.stiffness * (q / this.restLength - 1); var r, s, u; r = (this.pointMassA.getPos().getX() - this.pointMassA.getPrevPos().getX()) - (this.pointMassB.getPos().getX() - this.pointMassB.getPrevPos().getX()), s = (this.pointMassA.getPos().getY() - this.pointMassA.getPrevPos().getY()) - (this.pointMassB.getPos().getY() - this.pointMassB.getPrevPos().getY()), u = r * m + s * n, u *= this.damper; var z, A; z = (o + u) * m, A = (o + u) * n, this.tmp.setX(-z), this.tmp.setY(-A), this.pointMassA.addForce(this.tmp), this.tmp.setX(z), this.tmp.setY(A), this.pointMassB.addForce(this.tmp), this.pointMassA.move(l), this.pointMassB.move(l) }, this.addForce = function(l) { this.pointMassA.addForce(l), this.pointMassB.addForce(l) }, this.draw = function(l, m) { this.pointMassA.draw(l, m), this.pointMassB.draw(l, m), l.fillStyle = '#000000', l.strokeStyle = '#000000', l.beginPath(), l.moveTo(this.pointMassA.getXPos() * m, this.pointMassA.getYPos() * m), l.lineTo(this.pointMassB.getXPos() * m, this.pointMassB.getYPos() * m), l.stroke() } }

// Blob class
function Blob(b, d, e, g) {
    function k(s, u) { return (s + u) % u; }
    this.x = b; this.y = d; this.sticks = []; this.pointMasses = []; this.joints = [];
    this.middlePointMass; this.radius = e; this.drawFaceStyle = 1; this.drawEyeStyle = 1; this.selected = !1;
    g = 8; var m = 0.95, n = 1.05, o, q, r;
    for (q = 0, o = 0; q < g; q++) this.pointMasses[q] = new PointMass(Math.cos(o) * e + b, Math.sin(o) * e + d, 1), o += 2 * Math.PI / g;
    this.middlePointMass = new PointMass(b, d, 1);
    this.pointMasses[0].setMass(4); this.pointMasses[1].setMass(4);
    for (q = 0; q < g; q++) this.sticks[q] = new Stick(this.pointMasses[q], this.pointMasses[k(q + 1, g)]);
    for (q = 0, r = 0; q < g; q++) this.joints[r++] = new Joint(this.pointMasses[q], this.pointMasses[k(q + g / 2 + 1, g)], m, n), this.joints[r++] = new Joint(this.pointMasses[q], this.middlePointMass, 0.9 * n, 1.1 * m);
    this.addBlob = function(s) { var u = this.joints.length, z; this.joints[u] = new Joint(this.middlePointMass, s.getMiddlePointMass(), 0, 0), z = this.radius + s.getRadius(), this.joints[u].setDist(0.95 * z, 0) };
    this.getMiddlePointMass = function() { return this.middlePointMass };
    this.getRadius = function() { return this.radius };
    this.getXPos = function() { return this.middlePointMass.getXPos() };
    this.getYPos = function() { return this.middlePointMass.getYPos() };
    this.scale = function(s) { var u; for (u = 0; u < this.joints.length; u++) this.joints[u].scale(s); for (u = 0; u < this.sticks.length; u++) this.sticks[u].scale(s); this.radius *= s };
    this.move = function(s) { var u; for (u = 0; u < this.pointMasses.length; u++) this.pointMasses[u].move(s); this.middlePointMass.move(s) };
    this.sc = function(s) { var u, z; for (z = 0; 4 > z; z++) { for (u = 0; u < this.pointMasses.length; u++)!0 == s.collision(this.pointMasses[u].getPos()) ? this.pointMasses[u].setFriction(0.75) : this.pointMasses[u].setFriction(0.01); for (u = 0; u < this.sticks.length; u++) this.sticks[u].sc(s); for (u = 0; u < this.joints.length; u++) this.joints[u].sc() } };
    this.setForce = function(s) { var u; for (u = 0; u < this.pointMasses.length; u++) this.pointMasses[u].setForce(s); this.middlePointMass.setForce(s) };
    this.addForce = function(s) { var u; for (u = 0; u < this.pointMasses.length; u++) this.pointMasses[u].addForce(s); this.middlePointMass.addForce(s); this.pointMasses[0].addForce(s); this.pointMasses[0].addForce(s); this.pointMasses[0].addForce(s); this.pointMasses[0].addForce(s) };
    this.moveTo = function(s, u) { var z, A; for (A = this.middlePointMass.getPos(), s -= A.getX(), u -= A.getY(), z = 0; z < this.pointMasses.length; z++) A = this.pointMasses[z].getPos(), A.addX(s), A.addY(u); A = this.middlePointMass.getPos(), A.addX(s), A.addY(u) };
    this.setSelected = function(s) { this.selected = s };
    this.drawEars = function(s, u) { s.strokeStyle = '#000000', s.fillStyle = '#FFFFFF', s.lineWidth = 2, s.beginPath(), s.moveTo(-0.55 * this.radius * u, -0.35 * this.radius * u), s.lineTo(-0.52 * this.radius * u, -0.55 * this.radius * u), s.lineTo(-0.45 * this.radius * u, -0.4 * this.radius * u), s.fill(), s.stroke(), s.beginPath(), s.moveTo(0.55 * this.radius * u, -0.35 * this.radius * u), s.lineTo(0.52 * this.radius * u, -0.55 * this.radius * u), s.lineTo(0.45 * this.radius * u, -0.4 * this.radius * u), s.fill(), s.stroke() };
    this.drawHappyEyes1 = function(s, u) { s.lineWidth = 1, s.fillStyle = '#FFFFFF', s.beginPath(), s.arc(-0.15 * this.radius * u, -0.2 * this.radius * u, 0.12 * this.radius * u, 0, 2 * Math.PI, !1), s.fill(), s.stroke(), s.beginPath(), s.arc(0.15 * this.radius * u, -0.2 * this.radius * u, 0.12 * this.radius * u, 0, 2 * Math.PI, !1), s.fill(), s.stroke(), s.fillStyle = '#000000', s.beginPath(), s.arc(-0.15 * this.radius * u, -0.17 * this.radius * u, 0.06 * this.radius * u, 0, 2 * Math.PI, !1), s.fill(), s.beginPath(), s.arc(0.15 * this.radius * u, -0.17 * this.radius * u, 0.06 * this.radius * u, 0, 2 * Math.PI, !1), s.fill() };
    this.drawHappyEyes2 = function(s, u) { s.lineWidth = 1, s.fillStyle = '#FFFFFF', s.beginPath(), s.arc(-0.15 * this.radius * u, -0.2 * this.radius * u, 0.12 * this.radius * u, 0, 2 * Math.PI, !1), s.stroke(), s.beginPath(), s.arc(0.15 * this.radius * u, -0.2 * this.radius * u, 0.12 * this.radius * u, 0, 2 * Math.PI, !1), s.stroke(), s.lineWidth = 1, s.beginPath(), s.moveTo(-0.25 * this.radius * u, -0.2 * this.radius * u), s.lineTo(-0.05 * this.radius * u, -0.2 * this.radius * u), s.stroke(), s.beginPath(), s.moveTo(0.25 * this.radius * u, -0.2 * this.radius * u), s.lineTo(0.05 * this.radius * u, -0.2 * this.radius * u), s.stroke() };
    this.drawHappyFace1 = function(s, u) { s.lineWidth = 2, s.strokeStyle = '#000000', s.fillStyle = '#000000', s.beginPath(), s.arc(0, 0, 0.25 * this.radius * u, 0, Math.PI, !1), s.stroke() };
    this.drawHappyFace2 = function(s, u) { s.lineWidth = 2, s.strokeStyle = '#000000', s.fillStyle = '#000000', s.beginPath(), s.arc(0, 0, 0.25 * this.radius * u, 0, Math.PI, !1), s.fill() };
    this.drawOohFace = function(s, u) { s.lineWidth = 2, s.strokeStyle = '#000000', s.fillStyle = '#000000', s.beginPath(), s.arc(0, 0.1 * this.radius * u, 0.25 * this.radius * u, 0, Math.PI, !1), s.fill(), s.beginPath(), s.moveTo(-0.25 * this.radius * u, -0.3 * this.radius * u), s.lineTo(-0.05 * this.radius * u, -0.2 * this.radius * u), s.lineTo(-0.25 * this.radius * u, -0.1 * this.radius * u), s.moveTo(0.25 * this.radius * u, -0.3 * this.radius * u), s.lineTo(0.05 * this.radius * u, -0.2 * this.radius * u), s.lineTo(0.25 * this.radius * u, -0.1 * this.radius * u), s.stroke() };
    this.drawFace = function(s, u) { 1 == this.drawFaceStyle && 0.05 > Math.random() ? this.drawFaceStyle = 2 : 2 == this.drawFaceStyle && 0.1 > Math.random() && (this.drawFaceStyle = 1), 1 == this.drawEyeStyle && 0.025 > Math.random() ? this.drawEyeStyle = 2 : 2 == this.drawEyeStyle && 0.3 > Math.random() && (this.drawEyeStyle = 1), 4e-3 < this.middlePointMass.getVelocity() ? this.drawOohFace(s, u) : (1 == this.drawFaceStyle ? this.drawHappyFace1(s, u, 0, -0.3) : this.drawHappyFace2(s, u, 0, -0.3), 1 == this.drawEyeStyle ? this.drawHappyEyes1(s, u, 0, -0.3) : this.drawHappyEyes2(s, u, 0, -0.3)) };
    this.getPointMass = function(s) { return s += this.pointMasses.length, s %= this.pointMasses.length, this.pointMasses[s] };
    this.drawBody = function(s, u) { var z; for (s.strokeStyle = '#000000', s.fillStyle = !0 == this.selected ? '#FFCCCC' : '#FFFFFF', s.lineWidth = 5, s.beginPath(), s.moveTo(this.pointMasses[0].getXPos() * u, this.pointMasses[0].getYPos() * u), z = 0; z < this.pointMasses.length; z++) { var A, B, C, D, E, F, G, H, I, J, K, L; I = this.getPointMass(z - 1), J = this.pointMasses[z], K = this.getPointMass(z + 1), L = this.getPointMass(z + 2), E = K.getXPos(), F = K.getYPos(), G = J.getXPos(), H = J.getYPos(), A = 0.5 * G + 0.5 * E, B = 0.5 * H + 0.5 * F, C = G - I.getXPos() + E - L.getXPos(), D = H - I.getYPos() + F - L.getYPos(), A += 0.16 * C, B += 0.16 * D, A *= u, B *= u, E *= u, F *= u, s.bezierCurveTo(A, B, E, F, E, F) } s.closePath(), s.stroke(), s.fill() };
    this.draw = function(s, u) { var A, B, C; this.drawBody(s, u), s.strokeStyle = '#000000', s.fillStyle = '#000000', s.save(), s.translate(this.middlePointMass.getXPos() * u, (this.middlePointMass.getYPos() - 0.35 * this.radius) * u), A = new Vector(0, -1), B = new Vector(0, 0), B.set(this.pointMasses[0].getPos()), B.sub(this.middlePointMass.getPos()), C = Math.acos(B.dotProd(A) / B.length()), 0 > B.getX() ? s.rotate(-C) : s.rotate(C), this.drawFace(s, u), s.restore() }
}

// BlobCollective class
function BlobCollective(b, d, e, g) {
    this.maxNum = g, this.numActive = 1, this.blobs = [], this.tmpForce = new Vector(0, 0), this.selectedBlob = null, this.blobs[0] = new Blob(b, d, 0.4, 8);
    this.split = function() { var k, m = 0, n, o, q; if (this.numActive != this.maxNum) { for (n = this.blobs.length, k = 0; k < this.blobs.length; k++) null != this.blobs[k] && this.blobs[k].getRadius() > m ? (m = this.blobs[k].getRadius(), o = this.blobs[k]) : null == this.blobs[k] && (n = k); for (o.scale(0.75), q = new Blob(o.getXPos(), o.getYPos(), o.getRadius(), 8), k = 0; k < this.blobs.length; k++) null != this.blobs[k] && (this.blobs[k].addBlob(q), q.addBlob(this.blobs[k])); this.blobs[n] = q, this.numActive++ } };
    this.findSmallest = function(k) { var m, l = 1e3, n; for (n = 0; n < this.blobs.length; n++) n != k && null != this.blobs[n] && this.blobs[n].getRadius() < l && (m = n, l = this.blobs[n].getRadius()); return m };
    this.findClosest = function(k) { var m, n, o, q, l = 1e3, r, s, u; for (s = this.blobs[k].getMiddlePointMass(), r = 0; r < this.blobs.length; r++) r != k && null != this.blobs[r] && (u = this.blobs[r].getMiddlePointMass(), o = s.getXPos() - u.getXPos(), q = s.getYPos() - u.getYPos(), n = o * o + q * q, n < l && (l = n, m = r)); return m };
    this.join = function() { var k, l, o, q, r; 1 == this.numActive || (k = this.findSmallest(-1), l = this.findClosest(k), o = this.blobs[k].getRadius(), q = this.blobs[l].getRadius(), r = Math.sqrt(o * o + q * q), this.blobs[k] = null, this.blobs[l].scale(0.945 * r / q), this.numActive--) };
    this.selectBlob = function(k, l) { var m, o, n = 1e4, r = null; if (null == this.selectedBlob) { for (m = 0; m < this.blobs.length; m++) if (null != this.blobs[m]) { o = this.blobs[m].getMiddlePointMass(); var aXbX = k - o.getXPos(), aYbY = l - o.getYPos(), dist = aXbX * aXbX + aYbY * aYbY; dist < n && (n = dist, dist < 0.5 * this.blobs[m].getRadius() && (this.selectedBlob = this.blobs[m], r = { x: aXbX, y: aYbY })) } } return null != this.selectedBlob && this.selectedBlob.setSelected(!0), r };
    this.unselectBlob = function() { null == this.selectedBlob || (this.selectedBlob.setSelected(!1), this.selectedBlob = null) };
    this.selectedBlobMoveTo = function(k, l) { null == this.selectedBlob || this.selectedBlob.moveTo(k, l) };
    this.move = function(k) { var l; for (l = 0; l < this.blobs.length; l++) null != this.blobs[l] && this.blobs[l].move(k) };
    this.sc = function(k) { var l; for (l = 0; l < this.blobs.length; l++) null != this.blobs[l] && this.blobs[l].sc(k); };
    this.setForce = function(k) { var l; for (l = 0; l < this.blobs.length; l++) if (null != this.blobs[l]) { if (this.blobs[l] == this.selectedBlob) { this.blobs[l].setForce(new Vector(0, 0)); continue } this.blobs[l].setForce(k) } };
    this.addForce = function(k) { var l; for (l = 0; l < this.blobs.length; l++) null != this.blobs[l] && this.blobs[l] != this.selectedBlob && (this.tmpForce.setX(k.getX() * (0.75 * Math.random() + 0.25)), this.tmpForce.setY(k.getY() * (0.75 * Math.random() + 0.25)), this.blobs[l].addForce(this.tmpForce)) };
    this.draw = function(k, l) { var m; for (m = 0; m < this.blobs.length; m++) null != this.blobs[m] && this.blobs[m].draw(k, l) }
}

// Main game functions
function update() {
    if (null != savedMouseCoords && null != selectOffset) {
        blobColl.selectedBlobMoveTo(savedMouseCoords.x - selectOffset.x, savedMouseCoords.y - selectOffset.y);
    }
    blobColl.move(0.05);
    blobColl.sc(env);
    blobColl.setForce(gravity);
}

function draw() {
    var b = document.getElementById('blob');
    if (null != b.getContext) {
        var d = b.getContext('2d');
        d.clearRect(0, 0, width, height);
        env.draw(d, scaleFactor);
        blobColl.draw(d, scaleFactor);
    }
}

function timeout() {
    draw();
    update();
    if (!stopped) {
        setTimeout('timeout()', 30);
    }
}

function init() {
    function b(e) {
        if (null == e) e = window.event;
        return null == e ? null : e.pageX || e.pageY ? { x: e.pageX / scaleFactor, y: e.pageY / scaleFactor } : null;
    }
    var d = document.getElementById('blob');
    if (null == d.getContext) {
        alert('You need a modern browser for this to work, sorry.');
        return;
    }
    document.onkeydown = function(e) {
        var g;
        g = (null == e) ? window.event.keyCode : e.keyCode;
        switch (g) {
            case 37: blobColl.addForce(new Vector(-50, 0)); break; // Left
            case 38: blobColl.addForce(new Vector(0, -50)); break;  // Up
            case 39: blobColl.addForce(new Vector(50, 0)); break;   // Right
            case 40: blobColl.addForce(new Vector(0, 50)); break;   // Down
            case 74: blobColl.join(); break;  // J
            case 72: blobColl.split(); break; // H
            case 71: toggleGravity(); break; // G
        }
    };
    document.onmousedown = function(e) {
        if (stopped) return;
        var g = b(e);
        if (g == null) return;
        selectOffset = blobColl.selectBlob(g.x, g.y);
    };
    document.onmouseup = function() {
        blobColl.unselectBlob();
        savedMouseCoords = null;
        selectOffset = null;
    };
    document.onmousemove = function(e) {
        if (stopped || selectOffset == null) return;
        var g = b(e);
        if (g == null) return;
        blobColl.selectedBlobMoveTo(g.x - selectOffset.x, g.y - selectOffset.y);
        savedMouseCoords = g;
    };
    env = new Environment(0.2, 0.2, 2.6, 1.6);
    blobColl = new BlobCollective(1, 1, 1, 200);
    gravity = new Vector(0, 10);
    stopped = !1;
    timeout();
}

function stop() { stopped = !0; }
function start() { stopped = !1; timeout(); }
function toggleGravity() { 0 < gravity.getY() ? gravity.setY(0) : gravity.setY(10); }
