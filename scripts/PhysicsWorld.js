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

    init() {
        this.engine = Engine.create();
        // Plus d'itérations pour éviter que les objets passent à travers le plateau en mode rapide
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

    // =========================================================
    // CORRECTION MAJEURE : GESTION DES ZONES ET DU SOLVER
    // =========================================================

    /**
     * Ajoute un objet.
     * Si isInstant = true : Apparait directement sur le plateau (magie).
     * Si isInstant = false : Tombe du ciel (physique).
     */
    addToZone(zone, type, value, weightSystem, isInstant = false) {
        const xOffset = zone === 'left' ? -C.BALANCE.TRAY_OFFSET : C.BALANCE.TRAY_OFFSET;
        // Petit décalage aléatoire pour éviter les piles parfaites qui bugs
        const x = (this.width / 2) + xOffset + (Math.random() * 40 - 20);
        
        let y;
        if (isInstant) {
            // On le pose délicatement sur le plateau
            // BEAM_Y (140) + Chaine (280) + un peu de marge
            y = C.BALANCE.BEAM_Y + C.BALANCE.CHAIN_LENGTH + 40; 
        } else {
            // On le fait tomber du ciel
            y = C.SPAWN.DROP_HEIGHT; 
        }

        // Création via le WeightSystem (gère les couleurs rouge/bleu/gris)
        const body = weightSystem.create(type, x, y, value);
        
        // IMPORTANT : 
        // En mode Instantané, on triche un peu : on met lastZone à null pour que 
        // le ZoneMonitor (setupZoneMonitor) détecte l'objet comme "nouveau" et l'ajoute à l'équation.
        body.lastZone = null; 

        // Si c'est instantané, on reset la vélocité pour pas qu'il traverse le sol
        if(isInstant) {
            Body.setVelocity(body, { x: 0, y: 0 });
        }

        World.add(this.engine.world, body);
    }

    /**
     * Retire un objet.
     * Si isInstant = false (Mode Pluie) : On ne supprime rien ! On fait tomber de l'ANTIMATIÈRE.
     * Si isInstant = true (Mode Rapide) : On cherche l'objet, on le réduit ou on le supprime.
     */
    removeFromZone(zone, type, amountToRemove, weightSystem, isInstant = false) {
        
        // --- CAS 1 : MODE PLUIE (PHYSIQUE) ---
        // L'utilisateur veut retirer 1X. En physique, ça revient à ajouter -1X qui va s'annihiler au contact.
        if (!isInstant) {
            console.log(`[Mode Pluie] Largage d'antimatière sur ${zone} : -${amountToRemove}`);
            // On appelle simplement addToZone avec une valeur NÉGATIVE.
            // InteractionManager.js gère déjà l'annihilation (collision +X et -X).
            this.addToZone(zone, type, -amountToRemove, weightSystem, false);
            return;
        }

        // --- CAS 2 : MODE RAPIDE (INSTANTANÉ) ---
        // Là on fait de la chirurgie : on trouve l'objet et on modifie sa valeur.
        
        const bodies = Composite.allBodies(this.engine.world);
        
        // On cherche un candidat POSITIF du bon type sur le bon plateau
        const candidates = bodies.filter(b => {
            return b.label === 'weight' &&
                   this.detectZone(b) === zone &&
                   b.logicData.type === type &&
                   b.logicData.value > 0; // On ne réduit que les positifs
        });

        // On prend le premier trouvé (ou le plus adapté)
        const candidate = candidates[0];

        if (candidate) {
            // Calcul mathématique
            const oldValue = candidate.logicData.value;
            const newValue = oldValue - amountToRemove;

            // 1. On retire l'ancien corps (physique + logique)
            this.logicEngine.updateWeight(zone, type, oldValue, 'remove');
            World.remove(this.engine.world, candidate);

            // 2. Si le résultat n'est pas zéro, on recrée le corps résultant
            if (newValue !== 0) {
                // On recrée exactement au même endroit
                const { x, y } = candidate.position;
                const newBody = weightSystem.create(type, x, y, newValue);
                
                // Astuce : On le déclare déjà dans la zone pour éviter une double animation, 
                // mais on update le moteur logique manuellement juste après
                newBody.lastZone = zone; 
                this.logicEngine.updateWeight(zone, type, newValue, 'add');

                World.add(this.engine.world, newBody);
            }
            
            // Mise à jour de l'affichage
            if(this.onUpdateUI) this.onUpdateUI();

        } else {
            // CAS SPÉCIAL : Pas d'objet à réduire (ex: plateau vide).
            // Le client demande : "spawn un -x".
            console.log(`[Mode Rapide] Pas de cible, création directe de négatif.`);
            
            // On crée directement le négatif sur le plateau
            // Note : addToZone gère la création physique.
            // Comme c'est instantané, le ZoneMonitor va le détecter et mettre à jour l'équation (0 - x = -x).
            this.addToZone(zone, type, -amountToRemove, weightSystem, true);
        }
    }

    setupZoneMonitor() {
        Events.on(this.engine, 'afterUpdate', () => {
            this.frameCounter++;
            if (this.frameCounter % C.SPAWN.ZONE_CHECK_INTERVAL !== 0) return;

            const bodies = Composite.allBodies(this.engine.world);
            let hasChanged = false;

            bodies.forEach(body => {
                if (body.label !== 'weight') return;
                const currentZone = this.detectZone(body);
                // Si l'objet vient d'être créé (lastZone = null) et touche un plateau, on l'ajoute
                // Si l'objet change de plateau (rare mais possible), on update
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