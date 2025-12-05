import { BalanceModels } from './BalanceModels.js';
import { C } from './Constants.js';
import Matter from 'matter-js';

const { Engine, Render, Runner, World, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

export class PhysicsWorld {
    constructor(containerId, logicEngine) {
        this.logicEngine = logicEngine;
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        
        this.engine = null;
        this.beam = null;      
        this.leftTray = null;
        this.rightTray = null;
        
        this.frameCounter = 0; 
    }

    // ... (init, renderLabels, createBalance, createBoundaries, syncBeamAngle, clearWeights, setupDragEvents RESTENT INCHANGÉS) ...
    // COPIEZ LES MÉTHODES PRÉCÉDENTES ICI (init, syncBeamAngle, etc.)
    // JE NE REMETS QUE LES MÉTHODES MODIFIÉES CI-DESSOUS :

    init() {
        this.engine = Engine.create();
        this.engine.positionIterations = 20; 
        this.engine.velocityIterations = 20;

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
            this.renderLabels();
        });

        this.createBoundaries();
        this.createBalance('suspended'); 
        this.setupZoneMonitor();

        Render.run(render);
        const runner = Runner.create();
        Runner.run(runner, this.engine);

        Events.on(this.engine, 'beforeUpdate', () => {
            this.syncBeamAngle();
        });
    }

    // ... (renderLabels, createBalance, createBoundaries, syncBeamAngle, clearWeights, setupDragEvents : Gardez les versions précédentes) ...
    renderLabels() {
        const context = this.render.context;
        const bodies = Composite.allBodies(this.engine.world);
        context.font = "bold 16px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "white";
        bodies.forEach(body => {
            if (body.label === 'weight' && body.logicData) {
                const { type, value } = body.logicData;
                let text = type === 'X' ? (value === 1 ? "X" : `${value}X`) : value.toString();
                context.fillText(text, body.position.x, body.position.y);
            }
        });
    }

    createBalance(modelName) {
        if (this.beam) { World.clear(this.engine.world); this.createBoundaries(); }
        const model = BalanceModels[modelName](this.width/2, C.BALANCE.BEAM_Y, this.width, this.height);
        this.beam = model.beam;
        this.leftTray = model.leftTray;
        this.rightTray = model.rightTray;
        World.add(this.engine.world, model.composites);
    }

    createBoundaries() {
        const ground = Bodies.rectangle(this.width / 2, this.height + 60, this.width * 3, 100, { isStatic: true, label: 'ground' });
        const leftWall = Bodies.rectangle(-50, this.height/2, 100, this.height*4, { isStatic: true });
        const rightWall = Bodies.rectangle(this.width+50, this.height/2, 100, this.height*4, { isStatic: true });
        World.add(this.engine.world, [ground, leftWall, rightWall]);
    }

    syncBeamAngle() {
        if (!this.beam) return;
        const { targetAngle } = this.logicEngine.calculateTiltFactor();
        const currentAngle = this.beam.angle;
        if (currentAngle > C.PHYSICS.MAX_ANGLE) Body.setAngle(this.beam, C.PHYSICS.MAX_ANGLE);
        if (currentAngle < -C.PHYSICS.MAX_ANGLE) Body.setAngle(this.beam, -C.PHYSICS.MAX_ANGLE);
        const diff = targetAngle - currentAngle;
        if (Math.abs(diff) < 0.005) { Body.setAngularVelocity(this.beam, 0); return; }
        Body.setAngularVelocity(this.beam, diff * 0.05);
    }

    clearWeights() {
        const bodies = Composite.allBodies(this.engine.world);
        const weights = bodies.filter(b => b.label === 'weight');
        World.remove(this.engine.world, weights);
    }

    setupDragEvents() {
        const mouse = Mouse.create(this.container);
        this.mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } }
        });
        World.add(this.engine.world, this.mouseConstraint);
    }

    // --- CORRECTION AJOUT (Gère le mode Instantané) ---
    addToZone(zone, type, value, weightSystem, isInstant = false) {
        const xOffset = zone === 'left' ? -C.BALANCE.TRAY_OFFSET : C.BALANCE.TRAY_OFFSET;
        // X : un peu d'aléatoire pour ne pas empiler parfaitement
        const x = (this.width / 2) + xOffset + (Math.random() * 40 - 20);
        
        let y;
        if (isInstant) {
            // MODE INSTANT : On spawn DANS le plateau (au niveau du fléau + chaine)
            // On vise un peu au dessus du fond pour ne pas passer à travers
            y = C.BALANCE.BEAM_Y + C.BALANCE.CHAIN_LENGTH + 20; 
        } else {
            // MODE PLUIE : On spawn du ciel
            y = C.SPAWN.DROP_HEIGHT; 
        }

        const body = weightSystem.create(type, x, y, value);
        
        // Si c'est instantané, on dit au système qu'il est déjà dans la zone
        // Mais attention, le ZoneMonitor a besoin de voir le changement.
        // Le mieux est de laisser lastZone à null, le ZoneMonitor le verra "arriver" instantanément.
        body.lastZone = null; 

        World.add(this.engine.world, body);
    }

    // --- CORRECTION SUPPRESSION (Gère la mise à jour manuelle) ---
    removeFromZone(zone, type, amountToRemove, weightSystem) {
        const bodies = Composite.allBodies(this.engine.world);
        
        // 1. Chercher un candidat POSITIF à réduire
        const candidates = bodies.filter(b => {
            return b.label === 'weight' &&
                   this.detectZone(b) === zone &&
                   b.logicData.type === type &&
                   b.logicData.value > 0;
        });

        // On trie pour prendre le plus petit qui est assez grand, ou le plus grand dispo
        // Stratégie simple : prendre le premier trouvé qui matche
        const candidate = candidates.find(b => b.logicData.value >= amountToRemove) || candidates[0];

        if (candidate) {
            const oldValue = candidate.logicData.value;
            const remaining = oldValue - amountToRemove;
            
            // --- MISE À JOUR LOGIQUE MANUELLE (CRITIQUE) ---
            // On retire l'ancien poids de l'équation TOUT DE SUITE
            this.logicEngine.updateWeight(zone, type, oldValue, 'remove');
            
            // On supprime physiquement
            World.remove(this.engine.world, candidate);

            // Si il reste un morceau, on le recrée
            if (remaining > 0) {
                const pos = candidate.position;
                const newBody = weightSystem.create(type, pos.x, pos.y, remaining);
                newBody.lastZone = null; // Le ZoneMonitor va l'ajouter au prochain cycle
                // On remet la vitesse pour la continuité
                Body.setVelocity(newBody, candidate.velocity);
                World.add(this.engine.world, newBody);
            } else if (remaining < 0) {
                // Cas complexe : on a retiré plus que ce qu'il y avait (ex: retirer 5 à un bloc de 2)
                // Mathématiquement : on a retiré 2 (le bloc), il reste 3 à retirer.
                // On devrait créer de l'antimatière pour le reste (-3).
                const diff = Math.abs(remaining);
                const pos = candidate.position;
                const antiBody = weightSystem.create(type, pos.x, pos.y, -diff);
                antiBody.lastZone = null;
                World.add(this.engine.world, antiBody);
            }
            
            // On force une mise à jour UI immédiate
            if(this.onUpdateUI) this.onUpdateUI();
            
            return true;
        } else {
            // Cas B : Pas de poids positif trouvé.
            // On AJOUTE de l'antimatière (-amount)
            console.log(`Pas de poids trouvés dans ${zone}, ajout d'antimatière.`);
            // Note: addToZone gère l'ajout physique, le ZoneMonitor gérera l'ajout logique
            // Mais pour être cohérent avec le "Remove", on peut le faire ici.
            // Restons simple : addToZone va créer un corps, le ZoneMonitor verra un nouveau corps négatif arriver.
            // C'est valide mathématiquement : Ajouter -5 = Soustraire 5.
            this.addToZone(zone, type, -amountToRemove, weightSystem, true); // true = instantané (ou selon le switch, à voir dans main.js)
            return true;
        }
    }

    // ... (setupZoneMonitor, detectZone : Gardez les versions optimisées précédentes) ...
    setupZoneMonitor() {
        Events.on(this.engine, 'afterUpdate', () => {
            this.frameCounter++;
            if (this.frameCounter % C.SPAWN.ZONE_CHECK_INTERVAL !== 0) return;

            const bodies = Composite.allBodies(this.engine.world);
            let hasChanged = false;

            bodies.forEach(body => {
                if (body.label !== 'weight') return;
                const currentZone = this.detectZone(body);
                const lastZone = body.lastZone || null;

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