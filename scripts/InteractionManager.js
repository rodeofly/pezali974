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

    // --- GESTION FUSION ---
    setupCollisions() {
        Matter.Events.on(this.engine, 'collisionActive', (event) => {
            const pairs = event.pairs;
            const now = Date.now();

            // Récupération de l'objet actuellement tenu par la souris (s'il y en a un)
            const mouseConstraint = this.physicsWorld.mouseConstraint;
            const draggedBody = mouseConstraint ? mouseConstraint.body : null;

            pairs.forEach(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                if (bodyA.label !== 'weight' || bodyB.label !== 'weight') return;
                if (!bodyA.logicData || !bodyB.logicData) return;
                if (bodyA.logicData.type !== bodyB.logicData.type) return;

                // --- NOUVELLE RÈGLE DE SÉCURITÉ ---
                // La fusion ne se lance que si l'un des deux poids est en train d'être déplacé.
                // Cela empêche les fusions accidentelles quand les poids sont au repos dans le panier.
                const isDraggingA = (draggedBody === bodyA);
                const isDraggingB = (draggedBody === bodyB);

                const id = [bodyA.id, bodyB.id].sort().join('-');

                if (!isDraggingA && !isDraggingB) {
                    // Si on a lâché la souris, on annule toute fusion en cours pour cette paire
                    this.fusionCandidates.delete(id);
                    return;
                }
                // ----------------------------------

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