import Matter from 'matter-js';
import { C } from './Constants.js';

export class InteractionManager {
    constructor(engine, weightSystem, physicsWorld, logicEngine) {
        this.engine = engine;
        this.weightSystem = weightSystem;
        this.physicsWorld = physicsWorld;
        this.render = physicsWorld.render; 
        this.logicEngine = logicEngine;

        this.draggedBody = null;
        this.dragStartTime = 0;
        this.gracePeriod = 150;

        // Délai minimum entre deux fusions/annihilations : évite que 15 billes
        // s'agglutinent en une fraction de seconde quand on glisse à travers une pile.
        this.lastMergeTime = 0;
        this.mergeCooldown = 400;

        this.hammerMode = false;
        this.fusionEnabled = true; // agrégation par glisser (active en mode +)
        this.onWeightDestroyed = null; // callback(zone, logicData) pour la zone « détruits »

        // Mode − : le jumeau du côté opposé suit en miroir (axe vertical centré).
        this.subMode = false;
        this.mirrorBody = null;
        this.mirrorHome = null;
        this.onSymmetricRemove = null; // callback(logicData, symmetric)
    }

    setFusionEnabled(on) { this.fusionEnabled = on; }

    setSubtractMode(on) {
        this.subMode = on;
        if (!on) {
            this.physicsWorld.ignoredBody = null;
            this.mirrorBody = null;
            this.mirrorHome = null;
        }
    }

    /** Au début d'un drag en mode −, repère le jumeau identique du côté opposé. */
    beginMirror(body) {
        this.mirrorBody = null;
        this.mirrorHome = null;
        if (!body || !body.logicData) return;
        const zone = this.physicsWorld.detectZone(body);
        const opp = zone === 'left' ? 'right' : (zone === 'right' ? 'left' : null);
        if (!opp) return;
        const bodies = Matter.Composite.allBodies(this.engine.world);
        const twin = bodies.find(o => o !== body && o.label === 'weight' && o.logicData
            && o.logicData.type === body.logicData.type
            && o.logicData.value === body.logicData.value
            && this.physicsWorld.detectZone(o) === opp);
        if (twin) {
            this.mirrorBody = twin;
            this.mirrorHome = { x: twin.position.x, y: twin.position.y };
            this.physicsWorld.ignoredBody = twin; // ne pèse pas pendant qu'il suit
        }
    }

    /** Fin du drag en mode − : déposé dans la corbeille → retire les deux ; sinon, on remet le jumeau. */
    endMirror() {
        const dragged = this.draggedBody;
        const inTrash = dragged && this.physicsWorld.isOverTrash(dragged.position);
        if (inTrash) {
            const data = dragged.logicData ? { ...dragged.logicData } : null;
            [dragged, this.mirrorBody].forEach(b => {
                if (!b || b.isRemoved) return;
                if (b.lastZone) this.logicEngine.updateWeight(b.lastZone, b.logicData.type, b.logicData.value, 'remove');
                b.isRemoved = true;
                Matter.World.remove(this.engine.world, b);
            });
            if (this.onSymmetricRemove && data) this.onSymmetricRemove(data, !!this.mirrorBody);
            if (this.physicsWorld.onUpdateUI) this.physicsWorld.onUpdateUI();
        } else if (this.mirrorBody && this.mirrorHome) {
            // pas déposé : le jumeau retourne à sa place
            Matter.Body.setPosition(this.mirrorBody, this.mirrorHome);
            Matter.Body.setVelocity(this.mirrorBody, { x: 0, y: 0 });
        }
        this.physicsWorld.ignoredBody = null;
        this.mirrorBody = null;
        this.mirrorHome = null;
    }

    setHammerMode(on) {
        this.hammerMode = on;
        // En mode marteau, on coupe la prise à la souris (le clic détruit).
        this.physicsWorld.setMouseEnabled(!on);
        if (this.render && this.render.canvas) {
            this.render.canvas.style.cursor = on ? 'crosshair' : 'default';
        }
    }

    init() {
        this.setupDragTracking(); 
        this.setupCollisions();   
        this.setupClicks();
    }

    setupDragTracking() {
        Matter.Events.on(this.physicsWorld.mouseConstraint, 'startdrag', (event) => {
            this.draggedBody = event.body;
            this.dragStartTime = Date.now();
            this._dragStart = { x: event.body.position.x, y: event.body.position.y };
            // pèse encore tant qu'on n'a pas vraiment bougé (un clic ne le retire pas)
            this.physicsWorld.weightlessBody = null;
            if (this.subMode) this.beginMirror(event.body);
        });

        Matter.Events.on(this.physicsWorld.mouseConstraint, 'enddrag', (event) => {
            if (this.subMode) this.endMirror();
            const body = event.body || this.draggedBody;
            // Tap sur un vestige « 0 » (peu de mouvement) → puff + suppression.
            if (body && body.label === 'weight' && body.logicData
                && body.logicData.value === 0 && this._dragStart) {
                const dx = body.position.x - this._dragStart.x;
                const dy = body.position.y - this._dragStart.y;
                if (dx * dx + dy * dy < 100) {
                    this.spawnPuff(body.position.x, body.position.y);
                    if (body.lastZone) this.logicEngine.updateWeight(body.lastZone, body.logicData.type, 0, 'remove');
                    body.isRemoved = true;
                    Matter.World.remove(this.engine.world, body);
                    this.draggedBody = null;
                    this.dragStartTime = 0;
                    this._dragStart = null;
                    this.physicsWorld.weightlessBody = null;
                    if (this.physicsWorld.onUpdateUI) this.physicsWorld.onUpdateUI();
                    return;
                }
            }
            // Le poids relâché ne pèse pas tant qu'il n'a pas physiquement touché
            // un plateau ou un autre poids posé. Évite la "répulsion" perçue quand
            // on relâche à l'intérieur même du plateau (le poids serait recompté
            // immédiatement, et le plateau redescendrait avant le contact visuel).
            if (body && body.label === 'weight') body.needsLanding = true;
            this.draggedBody = null;
            this.dragStartTime = 0;
            this._dragStart = null;
            this.physicsWorld.weightlessBody = null;
        });

        Matter.Events.on(this.engine, 'beforeUpdate', () => {
            // Un objet ne perd son poids qu'au début d'un VRAI drag (> 8 px), pas au clic.
            if (this.draggedBody && this._dragStart && this.physicsWorld.weightlessBody !== this.draggedBody) {
                const dx = this.draggedBody.position.x - this._dragStart.x;
                const dy = this.draggedBody.position.y - this._dragStart.y;
                if (dx * dx + dy * dy > 64) this.physicsWorld.weightlessBody = this.draggedBody;
            }
            // Le jumeau suit en miroir (symétrie d'axe vertical centré).
            if (this.subMode && this.draggedBody && this.mirrorBody) {
                Matter.Body.setPosition(this.mirrorBody, {
                    x: this.physicsWorld.width - this.draggedBody.position.x,
                    y: this.draggedBody.position.y
                });
                Matter.Body.setVelocity(this.mirrorBody, { x: 0, y: 0 });
            }
        });
    }

    setupCollisions() {
        // Atterrissage : un poids relâché ne pèse qu'au premier contact solide.
        // NB : un plateau est un compound body (base + parois) ; les collisions
        // référencent les parts, pas le parent → il faut tester other.parent.label.
        const isLandingSurface = (other) => {
            const lbl = other.label;
            const parentLbl = other.parent && other.parent !== other ? other.parent.label : null;
            if (lbl === 'tray' || parentLbl === 'tray') return true;
            if (lbl === 'ground' || parentLbl === 'ground') return true;
            return false;
        };
        Matter.Events.on(this.engine, 'collisionActive', (event) => {
            event.pairs.forEach(pair => {
                const a = pair.bodyA, b = pair.bodyB;
                const land = (body, other) => {
                    if (!body.needsLanding) return;
                    if (isLandingSurface(other)) { body.needsLanding = false; return; }
                    if (other.label === 'weight' && !other.needsLanding) body.needsLanding = false;
                };
                land(a, b);
                land(b, a);
            });
        });

        Matter.Events.on(this.engine, 'collisionActive', (event) => {
            if (!this.fusionEnabled) return; // pas d'agrégation hors mode +

            const pairs = event.pairs;
            const now = Date.now();

            pairs.forEach(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                if (bodyA.label !== 'weight' || bodyB.label !== 'weight') return;
                if (!bodyA.logicData || !bodyB.logicData) return;
                if (bodyA.logicData.type !== bodyB.logicData.type) return;

                const isInteracting = (bodyA === this.draggedBody || bodyB === this.draggedBody);
                if (!isInteracting) return;

                if (now - this.dragStartTime < this.gracePeriod) return;
                // Une seule combinaison à la fois : on respecte le délai de refroidissement.
                if (now - this.lastMergeTime < this.mergeCooldown) return;

                // CAS A : ANNIHILATION (+ et -)
                if (Math.sign(bodyA.logicData.value) !== Math.sign(bodyB.logicData.value)) {
                    this.performAnnihilation(bodyA, bodyB);
                    this.lastMergeTime = now;
                }
                // CAS B : FUSION (+/+ OU -/-)
                else {
                    this.performFusion(bodyA, bodyB);
                    this.lastMergeTime = now;
                }
            });
        });
    }

    performAnnihilation(bodyA, bodyB) {
        if (bodyA.isRemoved || bodyB.isRemoved) return;

        if (bodyA.lastZone) this.logicEngine.updateWeight(bodyA.lastZone, bodyA.logicData.type, bodyA.logicData.value, 'remove');
        if (bodyB.lastZone) this.logicEngine.updateWeight(bodyB.lastZone, bodyB.logicData.type, bodyB.logicData.value, 'remove');

        const newVal = bodyA.logicData.value + bodyB.logicData.value;
        const type = bodyA.logicData.type;
        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;

        this.spawnPuff(newX, newY);

        bodyA.isRemoved = true; bodyB.isRemoved = true;
        Matter.World.remove(this.engine.world, [bodyA, bodyB]);

        // Toujours créer le corps résultat, même si la valeur est 0 :
        // le « 0 » reste visible (vestige), un tap dessus le fait poufer.
        const newBody = this.weightSystem.create(type, newX, newY, newVal);
        Matter.Body.setVelocity(newBody, { x: 0, y: 0 });
        newBody.lastZone = null;
        Matter.World.add(this.engine.world, newBody);
        if (this.draggedBody) this.draggedBody = newBody;
    }
    
    performFusion(bodyA, bodyB) {
        if (bodyA.isRemoved || bodyB.isRemoved) return;

        if (bodyA.lastZone) this.logicEngine.updateWeight(bodyA.lastZone, bodyA.logicData.type, bodyA.logicData.value, 'remove');
        if (bodyB.lastZone) this.logicEngine.updateWeight(bodyB.lastZone, bodyB.logicData.type, bodyB.logicData.value, 'remove');

        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;
        const type = bodyA.logicData.type;
        const newVal = bodyA.logicData.value + bodyB.logicData.value;

        this.spawnPuff(newX, newY);

        bodyA.isRemoved = true; bodyB.isRemoved = true;
        Matter.World.remove(this.engine.world, [bodyA, bodyB]);

        const newBody = this.weightSystem.create(type, newX, newY, newVal);
        Matter.Body.setVelocity(newBody, { x: 0, y: 0 });
        Matter.World.add(this.engine.world, newBody);

        if (this.draggedBody) this.draggedBody = newBody; 
    }

    setupClicks() {
        const pointToWeights = (event) => {
            const rect = this.render.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const bodies = Matter.Composite.allBodies(this.engine.world);
            return Matter.Query.point(bodies, { x, y }).filter(b => b.label === 'weight');
        };

        // Mode marteau : un clic découpe le poids visé (cf. hammerSplit).
        this.render.canvas.addEventListener('mousedown', (event) => {
            if (!this.hammerMode) return;
            const weights = pointToWeights(event);
            if (weights.length) this.hammerSplit(weights[0]);
        });

        // Double-clic souris : division (uniquement hors mode marteau).
        this.render.canvas.addEventListener('dblclick', (event) => {
            if (this.hammerMode) return;
            pointToWeights(event).forEach(body => this.performDivision(body));
        });

        // Double-tap tactile : équivalent du dblclick (le navigateur ne le
        // synthétise pas quand touch-action est désactivé sur le canvas).
        let tapStart = null;
        let lastTap = { time: 0, x: 0, y: 0 };
        this.render.canvas.addEventListener('touchstart', (event) => {
            if (event.touches.length !== 1) { tapStart = null; return; }
            const t = event.touches[0];
            tapStart = { time: Date.now(), x: t.clientX, y: t.clientY };
        }, { passive: true });
        this.render.canvas.addEventListener('touchend', (event) => {
            if (this.hammerMode || !tapStart) { tapStart = null; return; }
            const t = event.changedTouches[0];
            const dt = Date.now() - tapStart.time;
            const moved = Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y);
            tapStart = null;
            if (dt > 280 || moved > 12) return; // c'était un drag, pas un tap
            const now = Date.now();
            const distFromLast = Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y);
            if (now - lastTap.time < 350 && distFromLast < 40) {
                // 2e tap : double-tap → division au point relâché
                const rect = this.render.canvas.getBoundingClientRect();
                const bodies = Matter.Composite.allBodies(this.engine.world);
                Matter.Query.point(bodies, { x: t.clientX - rect.left, y: t.clientY - rect.top })
                    .filter(b => b.label === 'weight')
                    .forEach(body => this.performDivision(body));
                lastTap = { time: 0, x: 0, y: 0 };
            } else {
                lastTap = { time: now, x: t.clientX, y: t.clientY };
            }
        }, { passive: true });
    }

    /** Détruit un poids et le consigne dans la zone « détruits » de son côté. */
    destroyWeight(body) {
        if (body.isRemoved || !body.logicData) return;
        body.isRemoved = true;

        const zone = this.physicsWorld.detectZone(body)
            || (body.position.x < this.physicsWorld.width / 2 ? 'left' : 'right');

        if (body.lastZone) {
            this.logicEngine.updateWeight(body.lastZone, body.logicData.type, body.logicData.value, 'remove');
        }
        Matter.World.remove(this.engine.world, body);

        if (this.onWeightDestroyed) this.onWeightDestroyed(zone, { ...body.logicData });
        if (this.physicsWorld.onUpdateUI) this.physicsWorld.onUpdateUI();
    }

    /**
     * Coup de marteau « intelligent » : découpe le poids visé pour faire
     * apparaître la valeur présente sur l'AUTRE plateau (même espèce), afin de
     * pouvoir l'annuler ensuite. Si cette valeur est absente ou que le bloc est
     * trop petit pour la contenir → découpe aléatoire en deux morceaux.
     * Un poids unitaire (±1), indivisible, est simplement détruit.
     */
    hammerSplit(body) {
        if (body.isRemoved || !body.logicData) return;
        // Un poids unitaire (±1) est indivisible → on le détruit.
        if (Math.abs(body.logicData.value) <= 1) { this.destroyWeight(body); return; }
        this.spawnParts(body, this.computeSplitParts(body));
    }

    /**
     * Découpe en EXACTEMENT 2 morceaux (X comme constantes) : un morceau égal à
     * la valeur du même type sur l'AUTRE plateau (pour pouvoir l'annuler), et le
     * reste. Si cette valeur est absente ou trop grande (« on n'a pas cassé le
     * bon bloc »), coupe en deux au hasard.
     */
    computeSplitParts(body) {
        const val = body.logicData.value;
        const absVal = Math.abs(val);
        const sign = Math.sign(val);
        const type = body.logicData.type;

        const zone = this.physicsWorld.detectZone(body);
        let pieceAbs = 0;
        if (zone) {
            const opposite = zone === 'left' ? 'right' : 'left';
            pieceAbs = Math.abs(this.logicEngine.sumSideByType(opposite, type));
        }

        if (pieceAbs > 0 && pieceAbs < absVal) {
            return [pieceAbs * sign, (absVal - pieceAbs) * sign];
        }
        const a = 1 + Math.floor(Math.random() * (absVal - 1));
        return [a * sign, (absVal - a) * sign];
    }

    /** Remplace un poids par plusieurs morceaux (dont la somme = valeur d'origine). */
    spawnParts(body, parts) {
        const type = body.logicData.type;
        const { x, y } = body.position;

        if (body.lastZone) this.logicEngine.updateWeight(body.lastZone, type, body.logicData.value, 'remove');
        body.isRemoved = true;
        Matter.World.remove(this.engine.world, body);

        parts.forEach(partVal => {
            const offX = (Math.random() - 0.5) * 40;
            const offY = (Math.random() - 0.5) * 30;
            const nb = this.weightSystem.create(type, x + offX, y + offY, partVal);
            Matter.Body.setVelocity(nb, { x: 0, y: -1 });
            Matter.World.add(this.engine.world, nb);
        });
        if (this.physicsWorld.onUpdateUI) this.physicsWorld.onUpdateUI();
    }

    performDivision(body) {
        if (body.isRemoved || !body.logicData) return;
        if (Math.abs(body.logicData.value) <= 1) return;
        // Effet de vaporisation au point de division.
        this.spawnPuff(body.position.x, body.position.y);
        // Même découpe que le marteau : exactement 2 morceaux (valeur d'en face + reste).
        this.spawnParts(body, this.computeSplitParts(body));
    }

    /** Petit nuage de vapeur (cœur + 8 lobes) qui pop puis s'estompe en ~1.1 s. */
    spawnPuff(x, y) {
        const canvasRect = this.render.canvas.getBoundingClientRect();
        const px = x + canvasRect.left;
        const py = y + canvasRect.top;
        const puff = document.createElement('div');
        puff.className = 'puff';
        puff.style.left = `${px}px`;
        puff.style.top = `${py}px`;
        puff.setAttribute('aria-hidden', 'true');
        puff.innerHTML =
            '<span class="core"></span>' +
            '<span class="cloud c1"></span><span class="cloud c2"></span>' +
            '<span class="cloud c3"></span><span class="cloud c4"></span>' +
            '<span class="cloud c5"></span><span class="cloud c6"></span>' +
            '<span class="cloud c7"></span><span class="cloud c8"></span>';
        document.body.appendChild(puff);
        setTimeout(() => puff.remove(), 1300);
    }
}