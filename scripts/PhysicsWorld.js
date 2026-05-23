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
        // Toute la balance posée au sol : la base du socle touche le haut
        // du sol (groundTop = height - 120). trayBaseY est calculé pour que
        // mât (50 px) + socle (~hauteur de #center-trash) viennent affleurer.
        this.trayBaseY = this._computeTrayBaseY();
        this.frameCounter = 0;
        // Corps temporairement exclu du pesage.
        this.ignoredBody = null;
        // Corps réellement en cours de drag (déplacé) → ne pèse plus. Reste null
        // sur un simple clic (attrapé mais pas déplacé) : l'objet garde son poids.
        this.weightlessBody = null;
        // Aperçu de division : nombre de secteurs dessinés sur chaque poids (mode ÷).
        this.divisorPreview = 1;
        // Logo affiché sur le socle (chargé async ; dessiné dès que prêt).
        this._logo = new Image();
        this._logoReady = false;
        this._logo.onload = () => { this._logoReady = true; };
        this._logo.src = `${import.meta.env.BASE_URL}logo.svg`;
    }

    /** Calcule trayBaseY pour que le bas du socle affleure le haut du sol. */
    _computeTrayBaseY() {
        const groundTop = this.height - 120;
        const mastLen = 90;
        const pedH = this._centerTrashH || 100;
        // pivotTopY = base du plateau au repos = trayBaseY + 9 (demi-épaisseur).
        // pivotBaseY = pivotTopY + mastLen. Socle de pedH sous pivotBaseY.
        // → pivotBaseY + pedH = groundTop  ⇒  trayBaseY = groundTop − pedH − mastLen − 9.
        return groundTop - pedH - mastLen - 9;
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
                background: 'transparent',
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
        this.trayBaseY = this._computeTrayBaseY();

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
        // Centre-bas de chaque plateau = bout du fléau (point d'attache pivot).
        const lx2 = this.leftTray.position.x;
        const rx2 = this.rightTray.position.x;
        const ly = this.leftTray.bounds.max.y;
        const ry = this.rightTray.bounds.max.y;
        // Mât réduit au minimum : socle juste sous le pivot.
        const pivotBaseY = this.pivotTopY + 90;

        ctx.save();
        // Tout ce qu'on dessine ici va derrière les bodies déjà rendus
        // (plateaux + poids), mais devant le fond CSS noir.
        ctx.globalCompositeOperation = 'destination-over';

        // Symbole « = » (équilibre) ou « ≠ » (déséquilibre) juste au-dessus du pivot.
        // Dessiné en PREMIER → le plus en avant du calque arrière.
        const status = this.logicEngine.calculateTiltFactor().status;
        const isEq = status === 'EQUILIBRIUM';
        const symY = this.pivotTopY - 55;
        const halfW = 22;
        const gap = 8;
        ctx.save();
        ctx.lineCap = 'round';
        // Liseré sombre dessous (bevel)
        ctx.strokeStyle = isEq ? C.COLORS.GOLD_DARK : '#7a1f17';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, symY - gap); ctx.lineTo(cx + halfW, symY - gap);
        ctx.moveTo(cx - halfW, symY + gap); ctx.lineTo(cx + halfW, symY + gap);
        ctx.stroke();
        // Trait clair dessus
        ctx.strokeStyle = isEq ? C.COLORS.GOLD_LIGHT : '#e74c3c';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, symY - gap); ctx.lineTo(cx + halfW, symY - gap);
        ctx.moveTo(cx - halfW, symY + gap); ctx.lineTo(cx + halfW, symY + gap);
        ctx.stroke();
        // Barre diagonale du « ≠ »
        if (!isEq) {
            ctx.strokeStyle = '#7a1f17';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(cx - halfW + 2, symY + gap + 6);
            ctx.lineTo(cx + halfW - 2, symY - gap - 6);
            ctx.stroke();
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(cx - halfW + 2, symY + gap + 6);
            ctx.lineTo(cx + halfW - 2, symY - gap - 6);
            ctx.stroke();
        }
        ctx.restore();

        // Fléau : ligne entre les deux bouts (passe par le pivot central).
        const gradient = ctx.createLinearGradient(lx2, 0, rx2, 0);
        gradient.addColorStop(0, C.COLORS.WOOD_DARK);
        gradient.addColorStop(0.5, '#6b4f3f');
        gradient.addColorStop(1, C.COLORS.WOOD_DARK);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx2, ly);
        ctx.lineTo(rx2, ry);
        ctx.stroke();

        // Pivot central (axe de rotation du fléau).
        ctx.fillStyle = C.COLORS.GOLD_LIGHT;
        ctx.strokeStyle = C.COLORS.GOLD_DARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, this.pivotTopY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pivots aux bouts (articulation fléau ↔ plateau).
        ctx.fillStyle = C.COLORS.GOLD_DARK;
        ctx.beginPath(); ctx.arc(lx2, ly, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx2, ry, 4, 0, Math.PI * 2); ctx.fill();

        // Mât du pivot central jusqu'au socle en bas.
        ctx.strokeStyle = C.COLORS.WOOD_DARK;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, this.pivotTopY);
        ctx.lineTo(cx, pivotBaseY - 4);
        ctx.stroke();

        // Socle rectangulaire (bois) sur lequel le mât vient se poser.
        // Hauteur = écart pivotBaseY → sol, pour que le socle touche le sol
        // pile (peu importe la mesure cachée de #center-trash).
        const pedW = Math.max(280, Math.min(380, this.width * 0.84));
        const ctEl = document.getElementById('center-trash');
        if (ctEl) {
            const h = ctEl.getBoundingClientRect().height;
            if (h > 0) this._centerTrashH = h;
        }
        const groundTop = this.height - 120;
        const pedH = Math.max(40, groundTop - pivotBaseY);

        // Logo dessiné AVANT le socle (destination-over → premier = devant) :
        // il apparaît centré sur le socle, derrière les plateaux/poids.
        if (this._logoReady) {
            const aspect = (this._logo.naturalWidth / this._logo.naturalHeight) || 1;
            const maxW = pedW * 0.7;
            const maxH = pedH * 0.78;
            let logoH = maxH;
            let logoW = logoH * aspect;
            if (logoW > maxW) { logoW = maxW; logoH = logoW / aspect; }
            const px = cx - logoW / 2;
            const py = pivotBaseY + (pedH - logoH) / 2;
            const prevAlpha = ctx.globalAlpha;
            const prevFilter = ctx.filter;
            // Effet gravure : ombre sombre offset haut-gauche (rim qui casse
            // la lumière) + reflet clair offset bas-droite (fond du sillon).
            ctx.filter = 'drop-shadow(-1px -1px 0 rgba(0,0,0,0.75)) drop-shadow(1.5px 1.5px 0 rgba(255,255,255,0.28))';
            ctx.globalAlpha = 0.4;
            ctx.drawImage(this._logo, px, py, logoW, logoH);
            ctx.filter = prevFilter;
            ctx.globalAlpha = prevAlpha;
        }

        // Socle aux coins arrondis.
        const ped_r = 14;
        ctx.fillStyle = C.COLORS.WOOD_DARK;
        ctx.strokeStyle = '#2b1f18';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx - pedW / 2, pivotBaseY, pedW, pedH, ped_r);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    renderLabels() {
        const context = this.render.context;
        const bodies = Composite.allBodies(this.engine.world);
        
        // 'Cambria Math'/'STIX Two Math' offrent les italiques mathématiques (𝑥).
        context.font = "bold 32px 'Cambria Math', 'STIX Two Math', 'Latin Modern Math', 'Times New Roman', serif";
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
                    if (value === 1) text = "𝑥";
                    else if (value === -1) text = "-𝑥";
                    else text = `${value}𝑥`;
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

        // Décalage centroïde → bas du plateau, pour pouvoir placer le centre-bas
        // (point d'attache au bout du fléau) à la position arc-tangentielle exacte.
        this.leftTray.bottomOffset = this.leftTray.bounds.max.y - this.leftTray.position.y;
        this.rightTray.bottomOffset = this.rightTray.bounds.max.y - this.rightTray.position.y;
        // Position du pivot central : niveau du bas des plateaux au repos.
        // Le fléau s'incline autour de ce point.
        this.pivotTopY = this.leftTray.bounds.max.y;
        this.currentAngle = 0;
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
     * Place les bacs en arc autour du pivot central, selon le déséquilibre.
     * Le fléau a pour longueur 2·L ; chaque bout (et donc le centre-bas du
     * plateau qui y est fixé) suit un arc de rayon L. Les plateaux restent
     * horizontaux (on ne touche pas leur angle).
     */
    syncTrayPositions() {
        if (!this.leftTray || !this.rightTray) return;

        const { delta } = this.logicEngine.calculateTiltFactor();
        const L = C.BALANCE.TRAY_OFFSET;
        // Angle max dérivé du débattement vertical configuré.
        const maxAngle = Math.asin(Math.min(1, C.BALANCE.MAX_TRAVEL / L));
        const targetAngle = Math.max(-maxAngle, Math.min(maxAngle, delta * C.PHYSICS.SENSITIVITY / L));

        const ease = C.PHYSICS.EASING;
        this.currentAngle += (targetAngle - this.currentAngle) * ease;

        const theta = this.currentAngle;
        const cx = this.width / 2;
        const cos = Math.cos(theta), sin = Math.sin(theta);

        // delta > 0 → gauche plus lourde → bout gauche descend (y augmente),
        // et se rapproche du centre (x augmente). Symétrique à droite.
        const leftEndX  = cx - L * cos;
        const leftEndY  = this.pivotTopY + L * sin;
        const rightEndX = cx + L * cos;
        const rightEndY = this.pivotTopY - L * sin;

        Body.setPosition(this.leftTray,  { x: leftEndX,  y: leftEndY  - this.leftTray.bottomOffset  });
        Body.setPosition(this.rightTray, { x: rightEndX, y: rightEndY - this.rightTray.bottomOffset });
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
        // Suit la position courante du plateau (qui glisse horizontalement
        // quand le fléau s'incline). x à gauche du plateau, constantes à droite.
        const tray = zone === 'left' ? this.leftTray : this.rightTray;
        const typeOffset = (type === 'X') ? -C.BALANCE.TRAY_WIDTH / 4 : C.BALANCE.TRAY_WIDTH / 4;
        const x = tray.position.x + typeOffset + (Math.random() * 24 - 12);
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