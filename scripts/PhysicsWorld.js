import { BalanceModels } from './BalanceModels.js';
import { C, computeBalanceDims } from './Constants.js';
import Matter from 'matter-js';

const { Engine, Render, Runner, World, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

export class PhysicsWorld {
    constructor(containerId, logicEngine) {
        this.logicEngine = logicEngine;
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        computeBalanceDims(this.width, this.height);
        this.engine = null;
        this.leftTray = null;
        this.rightTray = null;
        // Bacs centrés verticalement, légèrement décalés sous la moitié
        // d'écran pour laisser de la place au fléau et à l'équation.
        this.trayBaseY = (this.height * 0.58) + (C.BALANCE.TRAY_WALL_HEIGHT / 2);
        this.frameCounter = 0;
        // Corps temporairement exclu du pesage.
        this.ignoredBody = null;
        // Corps réellement en cours de drag (déplacé) → ne pèse plus. Reste null
        // sur un simple clic (attrapé mais pas déplacé) : l'objet garde son poids.
        this.weightlessBody = null;
        // Aperçu de division : nombre de secteurs dessinés sur chaque poids (mode ÷).
        this.divisorPreview = 1;
    }

    /** Vrai si une position (coords canvas) est sur/au-dessus de la corbeille (mode −). */
    isOverTrash(pos) {
        const el = document.getElementById('center-trash');
        if (!el || el.classList.contains('hidden') || !this.render) return false;
        const r = el.getBoundingClientRect();
        const c = this.render.canvas.getBoundingClientRect();
        const x = pos.x + c.left, y = pos.y + c.top; // position en coords écran
        // Zone généreuse : on accepte de relâcher au-dessus et un peu autour
        // (le corps physique traîne derrière le curseur quand on lâche).
        return x >= r.left - 60 && x <= r.right + 60 && y >= r.top - 170 && y <= r.bottom + 30;
    }

    init() {
        this.engine = Engine.create();
        // Itérations élevées : résolution de collision fiable → les poids tirés
        // ne traversent plus les autres ni les parois (moins de « tunneling »).
        this.engine.positionIterations = 16;
        this.engine.velocityIterations = 16;
        this.engine.gravity.y = 0.9;

        const render = Render.create({
            element: this.container,
            engine: this.engine,
            options: {
                width: this.width,
                height: this.height,
                wireframes: false,
                background: C.COLORS.BACKGROUND,
                showAngleIndicator: false
            }
        });
        this.render = render;
        
        Events.on(render, 'afterRender', () => {
            this.renderBalanceFrame();
            this.renderLabels();
            this.renderDivisionSectors();
        });

        this.createBoundaries();
        this.createBalance('simple');
        this.setupZoneMonitor();

        Render.run(render);
        const runner = Runner.create();
        Runner.run(runner, this.engine);

        Events.on(this.engine, 'beforeUpdate', () => {
            this.syncTrayPositions();
        });

        this._installResizeListener();
    }

    _installResizeListener() {
        let t = null;
        window.addEventListener('resize', () => {
            clearTimeout(t);
            t = setTimeout(() => this.resize(), 120);
        });
        window.addEventListener('orientationchange', () => {
            clearTimeout(t);
            t = setTimeout(() => this.resize(), 200);
        });
    }

    /**
     * Recalcule les dimensions de la balance et du canvas suite à un resize
     * de la fenêtre. Les poids présents sont conservés ; on les replace dans
     * la fenêtre si la nouvelle taille les a laissés en dehors.
     */
    resize() {
        const newW = this.container.clientWidth;
        const newH = this.container.clientHeight;
        if (newW === this.width && newH === this.height) return;

        this.width = newW;
        this.height = newH;
        computeBalanceDims(newW, newH);
        this.trayBaseY = (newH * 0.58) + (C.BALANCE.TRAY_WALL_HEIGHT / 2);

        this.render.canvas.width = newW;
        this.render.canvas.height = newH;
        this.render.options.width = newW;
        this.render.options.height = newH;
        Render.setPixelRatio(this.render, window.devicePixelRatio || 1);

        const weights = Composite.allBodies(this.engine.world).filter(b => b.label === 'weight');
        const saved = weights.map(b => ({
            type: b.logicData?.type,
            value: b.logicData?.value,
            zone: b.lastZone || this.detectZone(b)
        })).filter(s => s.type && s.zone);

        World.clear(this.engine.world, false);
        this.createBoundaries();
        this.createBalance('simple');

        if (this.mouseConstraint) World.add(this.engine.world, this.mouseConstraint);

        if (this._onResized) this._onResized(saved);
    }

    /**
     * Callback appelé en fin de resize avec la liste des poids à rétablir.
     * Permet à main.js de remettre la logique à zéro avant de respawner.
     */
    onResized(fn) { this._onResized = fn; }

    /**
     * Dessine le fléau (barre tilable entre les deux plateaux), un mât central
     * et un pivot triangulaire. Le fléau s'incline naturellement parce que
     * les plateaux bougent en Y selon le déséquilibre.
     */
    renderBalanceFrame() {
        if (!this.leftTray || !this.rightTray) return;
        const ctx = this.render.context;
        const cx = this.width / 2;
        const wallH = C.BALANCE.TRAY_WALL_HEIGHT;
        const lx = this.leftTray.position.x;
        const rx = this.rightTray.position.x;
        const ly = this.leftTray.position.y - wallH / 2;
        const ry = this.rightTray.position.y - wallH / 2;
        const beamY = (ly + ry) / 2 - 12;
        const pivotBaseY = this.trayBaseY + 70;

        ctx.save();

        ctx.strokeStyle = 'rgba(189,195,199,0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly - 22);
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry - 22);
        ctx.stroke();
        ctx.setLineDash([]);

        const gradient = ctx.createLinearGradient(lx, 0, rx, 0);
        gradient.addColorStop(0, C.COLORS.WOOD_DARK);
        gradient.addColorStop(0.5, '#6b4f3f');
        gradient.addColorStop(1, C.COLORS.WOOD_DARK);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx, ly - 22);
        ctx.lineTo(rx, ry - 22);
        ctx.stroke();

        ctx.fillStyle = C.COLORS.GOLD_LIGHT;
        ctx.beginPath();
        ctx.arc(cx, beamY - 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.COLORS.GOLD_DARK;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.strokeStyle = C.COLORS.WOOD_DARK;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, beamY - 4);
        ctx.lineTo(cx, pivotBaseY - 4);
        ctx.stroke();

        const pivotW = 90;
        const pivotH = 50;
        ctx.fillStyle = C.COLORS.WOOD_DARK;
        ctx.strokeStyle = '#2b1f18';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, pivotBaseY - pivotH);
        ctx.lineTo(cx - pivotW / 2, pivotBaseY);
        ctx.lineTo(cx + pivotW / 2, pivotBaseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2b1f18';
        ctx.fillRect(cx - pivotW * 0.7, pivotBaseY, pivotW * 1.4, 8);

        ctx.restore();
    }

    renderLabels() {
        const context = this.render.context;
        const bodies = Composite.allBodies(this.engine.world);
        
        context.font = "bold 20px 'Times New Roman', serif"; 
        context.textAlign = "center";
        context.textBaseline = "middle";

        bodies.forEach(body => {
            if (body.label === 'weight' && body.logicData) {
                const { type, value } = body.logicData;
                let text = "";

                // --- CORRECTION COULEUR ---
                // Si négatif (fond clair), texte NOIR. Sinon BLANC.
                context.fillStyle = (value < 0) ? "#000000" : "#ffffff";

                if (type === 'X') {
                    if (value === 1) text = "x";
                    else if (value === -1) text = "-x";
                    else text = `${value}x`;
                } else {
                    text = value.toString();
                }
                
                context.fillText(text, body.position.x, body.position.y);
            }
        });
    }

    /** Aperçu ÷ : découpe chaque poids en N secteurs de disque (traits pointillés). */
    renderDivisionSectors() {
        const N = this.divisorPreview;
        if (!N || N < 2) return;
        const ctx = this.render.context;
        const bodies = Composite.allBodies(this.engine.world);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        bodies.forEach(body => {
            if (body.label !== 'weight') return;
            const { x, y } = body.position;
            let r = body.circleRadius;
            if (!r) {
                const w = body.bounds.max.x - body.bounds.min.x;
                const h = body.bounds.max.y - body.bounds.min.y;
                r = Math.min(w, h) / 2;
            }
            for (let k = 0; k < N; k++) {
                const ang = (Math.PI * 2 * k) / N - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    createBalance(modelName) {
        if (this.leftTray) { World.clear(this.engine.world); this.createBoundaries(); }
        const model = BalanceModels[modelName](this.width / 2, this.trayBaseY);
        this.leftTray = model.leftTray;
        this.rightTray = model.rightTray;
        World.add(this.engine.world, model.composites);
    }

    /** Hauteur d'apparition d'un poids, relative à la position des bacs. */
    getSpawnY(isInstant = false) {
        const openingTop = this.trayBaseY - C.BALANCE.TRAY_WALL_HEIGHT;
        return isInstant ? this.trayBaseY - 20 : openingTop - 60;
    }

    createBoundaries() {
        // Sol relevé au-dessus de la barre du bas : les poids libres (banque,
        // ou tombés à côté d'un bac) restent visibles et restent attrapables.
        const groundTop = this.height - 120;
        const ground = Bodies.rectangle(this.width / 2, groundTop + 50, this.width * 3, 100, {
            isStatic: true, label: 'ground', render: { fillStyle: '#26262e' }
        });
        const leftWall = Bodies.rectangle(-50, this.height/2, 100, this.height*4, { isStatic: true });
        const rightWall = Bodies.rectangle(this.width+50, this.height/2, 100, this.height*4, { isStatic: true });
        World.add(this.engine.world, [ground, leftWall, rightWall]);
    }

    /**
     * Déplace verticalement les deux bacs selon le déséquilibre :
     * le côté le plus lourd descend, l'autre monte. Mouvement lissé,
     * borné par MAX_TRAVEL → la balance ne « part plus dans tous les sens ».
     */
    syncTrayPositions() {
        if (!this.leftTray || !this.rightTray) return;

        const { delta } = this.logicEngine.calculateTiltFactor();
        const max = C.BALANCE.MAX_TRAVEL;
        const offset = Math.max(-max, Math.min(max, delta * C.PHYSICS.SENSITIVITY));

        // delta > 0 : la gauche est plus lourde → elle descend (y augmente)
        const leftTarget = this.trayBaseY + offset;
        const rightTarget = this.trayBaseY - offset;
        const ease = C.PHYSICS.EASING;

        const moveTray = (tray, targetY) => {
            const newY = tray.position.y + (targetY - tray.position.y) * ease;
            Body.setPosition(tray, { x: tray.position.x, y: newY });
        };

        moveTray(this.leftTray, leftTarget);
        moveTray(this.rightTray, rightTarget);
    }

    clearWeights() {
        const bodies = Composite.allBodies(this.engine.world);
        const weights = bodies.filter(b => b.label === 'weight');
        World.remove(this.engine.world, weights);
    }

    setupDragEvents() {
        const mouse = Mouse.create(this.container);
        this.dragMask = 0xFFFFFFFF;
        // Stiffness faible + amortissement : le poids suit la souris en douceur
        // sans « lutter » contre les collisions → plus de vibrations dans les bacs.
        this.mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            collisionFilter: { mask: this.dragMask },
            // Prise plus ferme + amortie : le poids suit bien la souris tout en
            // étant stoppé par les autres poids et les parois (moins de traversée).
            constraint: { stiffness: 0.25, damping: 0.3, render: { visible: false } }
        });
        World.add(this.engine.world, this.mouseConstraint);

        // Filet de sécurité : si le mouseup arrive au-dessus d'un panneau HTML
        // (ex. la banque), Matter ne le reçoit pas. On force alors le relâchement
        // pour que le poids ne reste pas « collé » à la souris.
        window.addEventListener('mouseup', () => {
            setTimeout(() => {
                if (this.mouseConstraint && this.mouseConstraint.body) {
                    this.mouseConstraint.constraint.bodyB = null;
                    this.mouseConstraint.body = null;
                }
            }, 0);
        });
    }

    /** Active/désactive la prise à la souris (coupée en mode marteau). */
    setMouseEnabled(enabled) {
        if (!this.mouseConstraint) return;
        this.mouseConstraint.collisionFilter.mask = enabled ? this.dragMask : 0;
        // Relâche immédiatement un éventuel poids tenu.
        this.mouseConstraint.constraint.bodyB = null;
        this.mouseConstraint.body = null;
    }

    addToZone(zone, type, value, weightSystem, isInstant = false) {
        const xOffset = zone === 'left' ? -C.BALANCE.TRAY_OFFSET : C.BALANCE.TRAY_OFFSET;
        const x = (this.width / 2) + xOffset + (Math.random() * 30 - 15);
        // Mode rapide : on dépose juste à l'intérieur du bac. Mode pluie : ça tombe d'au-dessus.
        const y = this.getSpawnY(isInstant);
        const body = weightSystem.create(type, x, y, value);
        body.lastZone = null; 
        if(isInstant) Body.setVelocity(body, { x: 0, y: 0 });
        World.add(this.engine.world, body);
    }

    removeFromZone(zone, type, amountToRemove, weightSystem, isInstant = false) {
        if (!isInstant) {
            this.addToZone(zone, type, -amountToRemove, weightSystem, false);
            return;
        }

        const bodies = Composite.allBodies(this.engine.world);
        const candidates = bodies.filter(b => {
            return b.label === 'weight' &&
                   this.detectZone(b) === zone &&
                   b.logicData.type === type &&
                   b.logicData.value > 0; 
        });

        const candidate = candidates[0];

        if (candidate) {
            const oldValue = candidate.logicData.value;
            const newValue = oldValue - amountToRemove;
            this.logicEngine.updateWeight(zone, type, oldValue, 'remove');
            World.remove(this.engine.world, candidate);
            if (newValue !== 0) {
                const { x, y } = candidate.position;
                const newBody = weightSystem.create(type, x, y, newValue);
                newBody.lastZone = zone; 
                this.logicEngine.updateWeight(zone, type, newValue, 'add');
                World.add(this.engine.world, newBody);
            }
            if(this.onUpdateUI) this.onUpdateUI();
        } else {
            this.addToZone(zone, type, -amountToRemove, weightSystem, true);
        }
    }

    setupZoneMonitor() {
        Events.on(this.engine, 'afterUpdate', () => {
            this.frameCounter++;
            if (this.frameCounter % C.SPAWN.ZONE_CHECK_INTERVAL !== 0) return;
            const bodies = Composite.allBodies(this.engine.world);
            const draggedBody = this.weightlessBody; // poids réellement en cours de drag
            let hasChanged = false;
            bodies.forEach(body => {
                if (body.label !== 'weight') return;
                // Un poids tenu à la souris (ou son jumeau miroir) ne pèse pas :
                // il est « dans la main ». Évite la boucle : retirer un poids allège
                // le bac, qui remonte, rattrape le poids, qui repèse, etc.
                // Un poids tenu, ignoré, ou en attente d'atterrissage (vient
                // d'être relâché et n'a pas encore touché un plateau) ne pèse pas.
                const inHand = body === draggedBody || body === this.ignoredBody || body.needsLanding;
                const currentZone = inHand ? null : this.detectZone(body);
                const lastZone = body.lastZone || null;

                // Gate : un poids n'est pris en compte qu'une fois POSÉ (vitesse
                // faible). Tant qu'il chute, il ne pèse pas → le bac ne s'enfuit
                // plus sous lui (plus d'« effet répulsif »).
                if (currentZone && currentZone !== lastZone && body.speed > C.PHYSICS.SETTLE_SPEED) return;

                if (currentZone !== lastZone) {
                    if (body.logicData) {
                        if (lastZone) this.logicEngine.updateWeight(lastZone, body.logicData.type, body.logicData.value, 'remove');
                        if (currentZone) this.logicEngine.updateWeight(currentZone, body.logicData.type, body.logicData.value, 'add');
                        hasChanged = true;
                    }
                    body.lastZone = currentZone;
                }
            });
            if (hasChanged && this.onUpdateUI) this.onUpdateUI();
        });
    }

    detectZone(body) {
        const pos = body.position;
        if (Matter.Bounds.contains(this.leftTray.bounds, pos)) return 'left';
        if (Matter.Bounds.contains(this.rightTray.bounds, pos)) return 'right';
        return null;
    }
}