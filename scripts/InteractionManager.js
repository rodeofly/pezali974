import Matter from 'matter-js';
import { C } from './Constants.js';

export class InteractionManager {
    // MODIFICATION DU CONSTRUCTEUR : on reçoit 'physicsWorld'
    constructor(engine, weightSystem, physicsWorld, logicEngine) {
        this.engine = engine;
        this.weightSystem = weightSystem;
        this.physicsWorld = physicsWorld; // Pour accéder à mouseConstraint
        this.render = physicsWorld.render; // On récupère le render depuis le world
        this.logicEngine = logicEngine;
        
        this.fusionDelay = 250; 
        this.divisionMode = 'atomic'; 
        
        this.fusionCandidates = new Map(); 
    }

    init() {
        this.setupCollisions();
        this.setupClicks();
    }

    setDivisionMode(mode) {
        this.divisionMode = mode;
    }

    // --- GESTION FUSION & ANNIHILATION ---
    setupCollisions() {
        Matter.Events.on(this.engine, 'collisionActive', (event) => {
            const pairs = event.pairs;
            const now = Date.now();
            const mouseConstraint = this.physicsWorld.mouseConstraint;
            const draggedBody = mouseConstraint ? mouseConstraint.body : null;

            pairs.forEach(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                if (bodyA.label !== 'weight' || bodyB.label !== 'weight') return;
                if (!bodyA.logicData || !bodyB.logicData) return;
                if (bodyA.logicData.type !== bodyB.logicData.type) return;

                // --- LOGIQUE ANNIHILATION (Contact immédiat) ---
                // Si les signes sont opposés : BOOM
                if (Math.sign(bodyA.logicData.value) !== Math.sign(bodyB.logicData.value)) {
                    this.performAnnihilation(bodyA, bodyB);
                    return; // Stop traitement
                }

                // ... (Reste de la logique Fusion avec délai et Dragging inchangée) ...
                // Copiez-collez votre ancienne logique "isDragging" ici
                const isDraggingA = (draggedBody === bodyA);
                const isDraggingB = (draggedBody === bodyB);
                const id = [bodyA.id, bodyB.id].sort().join('-');

                if (!isDraggingA && !isDraggingB) {
                    this.fusionCandidates.delete(id);
                    return;
                }

                if (!this.fusionCandidates.has(id)) {
                    this.fusionCandidates.set(id, now);
                } else {
                    const startTime = this.fusionCandidates.get(id);
                    if (now - startTime > this.fusionDelay) {
                        this.performFusion(bodyA, bodyB);
                        this.fusionCandidates.delete(id); 
                    }
                }
            });
        });

        Matter.Events.on(this.engine, 'collisionEnd', (event) => {
            event.pairs.forEach(pair => {
                const id = [pair.bodyA.id, pair.bodyB.id].sort().join('-');
                this.fusionCandidates.delete(id);
            });
        });
    }

    performAnnihilation(bodyA, bodyB) {
        // Supposons A = 5, B = -5. Résultat = 0. Tout disparaît.
        // Supposons A = 5, B = -2. Résultat = 3. A devient 3, B meurt.
        
        // Pour simplifier V1 : On ne gère que l'annihilation totale ou simple
        // Ici, on va faire une fusion mathématique standard
        // 5 + (-2) = 3. 
        
        // 1. Retrait logique
        if (bodyA.lastZone) this.logicEngine.updateWeight(bodyA.lastZone, bodyA.logicData.type, bodyA.logicData.value, 'remove');
        if (bodyB.lastZone) this.logicEngine.updateWeight(bodyB.lastZone, bodyB.logicData.type, bodyB.logicData.value, 'remove');

        const newVal = bodyA.logicData.value + bodyB.logicData.value;
        const type = bodyA.logicData.type;
        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;

        console.log(`💥 ANNIHILATION : ${bodyA.logicData.value} + ${bodyB.logicData.value} = ${newVal}`);

        Matter.World.remove(this.engine.world, [bodyA, bodyB]);

        // Si le résultat n'est pas 0, on crée le reste
        if (newVal !== 0) {
            const newBody = this.weightSystem.create(type, newX, newY, newVal);
            // On lui donne une petite impulsion visuelle
            Matter.Body.setVelocity(newBody, { x: 0, y: -2 });
            Matter.World.add(this.engine.world, newBody);
        }
    }
    
    performFusion(bodyA, bodyB) {
        // Retrait Logique
        if (bodyA.lastZone) this.logicEngine.updateWeight(bodyA.lastZone, bodyA.logicData.type, bodyA.logicData.value, 'remove');
        if (bodyB.lastZone) this.logicEngine.updateWeight(bodyB.lastZone, bodyB.logicData.type, bodyB.logicData.value, 'remove');

        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;
        const type = bodyA.logicData.type;
        const newVal = bodyA.logicData.value + bodyB.logicData.value;

        // Effet visuel console
        console.log(`✨ FUSION DRAG : ${newVal}`);

        Matter.World.remove(this.engine.world, [bodyA, bodyB]);

        // CRÉATION CENTRALISÉE
        const newBody = this.weightSystem.create(type, newX, newY, newVal);

        Matter.World.add(this.engine.world, newBody);
        
        // Petit détail UX : Si on fusionne pendant le drag, 
        // le nouveau corps n'est pas automatiquement "attrapé" par la souris.
        // L'utilisateur devra recliquer pour bouger le résultat. C'est normal.
    }

    // --- GESTION DIVISION (Inchangée mais incluse pour copie complète) ---
    setupClicks() {
        this.render.canvas.addEventListener('dblclick', (event) => {
            const rect = this.render.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const bodies = Matter.Composite.allBodies(this.engine.world);
            const clickedBodies = Matter.Query.point(bodies, { x, y });

            clickedBodies.forEach(body => {
                if (body.label === 'weight') {
                    this.performDivision(body);
                }
            });
        });
    }

    performDivision(body) {
        const val = body.logicData.value;
        if (val <= 1) return;

        if (body.lastZone) {
            this.logicEngine.updateWeight(body.lastZone, body.logicData.type, val, 'remove');
        }

        let parts = [];
        if (this.divisionMode === 'atomic') {
            for(let i=0; i<val; i++) parts.push(1);
        } 
        else if (this.divisionMode === 'binary') {
            const half = Math.floor(val / 2);
            parts.push(half, val - half);
        }

        Matter.World.remove(this.engine.world, body);

        parts.forEach((partVal) => {
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;

            // CRÉATION CENTRALISÉE
            const newBody = this.weightSystem.create(body.logicData.type, body.position.x + offsetX, body.position.y + offsetY, partVal);

            Matter.Body.setVelocity(newBody, { x: offsetX * 0.1, y: -2 });
            Matter.World.add(this.engine.world, newBody);
        });
    }
}