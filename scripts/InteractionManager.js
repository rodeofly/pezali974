import Matter from 'matter-js';
import { C } from './Constants.js';

export class InteractionManager {
    constructor(engine, weightSystem, physicsWorld, logicEngine) {
        this.engine = engine;
        this.weightSystem = weightSystem;
        this.physicsWorld = physicsWorld;
        this.render = physicsWorld.render; 
        this.logicEngine = logicEngine;
        
        this.divisionMode = 'atomic'; 
        this.draggedBody = null;
        this.dragStartTime = 0;
        this.gracePeriod = 150; 
    }

    init() {
        this.setupDragTracking(); 
        this.setupCollisions();   
        this.setupClicks();       
    }

    setDivisionMode(mode) {
        this.divisionMode = mode;
    }

    setupDragTracking() {
        Matter.Events.on(this.physicsWorld.mouseConstraint, 'startdrag', (event) => {
            this.draggedBody = event.body;
            this.dragStartTime = Date.now();
        });

        Matter.Events.on(this.physicsWorld.mouseConstraint, 'enddrag', () => {
            this.draggedBody = null;
            this.dragStartTime = 0;
        });
    }

    setupCollisions() {
        Matter.Events.on(this.engine, 'collisionActive', (event) => {
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

                // CAS A : ANNIHILATION (+ et -)
                if (Math.sign(bodyA.logicData.value) !== Math.sign(bodyB.logicData.value)) {
                    this.performAnnihilation(bodyA, bodyB);
                }
                // CAS B : FUSION (+/+ OU -/-)
                else {
                    // J'AI SUPPRIMÉ LE BLOCAGE ICI : Les négatifs peuvent maintenant fusionner !
                    this.performFusion(bodyA, bodyB);
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

        console.log(`💥 ANNIHILATION : ${newVal}`);

        bodyA.isRemoved = true; bodyB.isRemoved = true;
        Matter.World.remove(this.engine.world, [bodyA, bodyB]);

        if (newVal !== 0) {
            const newBody = this.weightSystem.create(type, newX, newY, newVal);
            Matter.Body.setVelocity(newBody, { x: 0, y: -1 });
            newBody.lastZone = null; 
            Matter.World.add(this.engine.world, newBody);
            if (this.draggedBody) this.draggedBody = newBody;
        }
    }
    
    performFusion(bodyA, bodyB) {
        if (bodyA.isRemoved || bodyB.isRemoved) return;

        if (bodyA.lastZone) this.logicEngine.updateWeight(bodyA.lastZone, bodyA.logicData.type, bodyA.logicData.value, 'remove');
        if (bodyB.lastZone) this.logicEngine.updateWeight(bodyB.lastZone, bodyB.logicData.type, bodyB.logicData.value, 'remove');

        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;
        const type = bodyA.logicData.type;
        const newVal = bodyA.logicData.value + bodyB.logicData.value;

        console.log(`✨ FUSION : ${newVal}`);

        bodyA.isRemoved = true; bodyB.isRemoved = true;
        Matter.World.remove(this.engine.world, [bodyA, bodyB]);

        const newBody = this.weightSystem.create(type, newX, newY, newVal);
        Matter.Body.setVelocity(newBody, { x: 0, y: 0 });
        Matter.World.add(this.engine.world, newBody);

        if (this.draggedBody) this.draggedBody = newBody; 
    }

    setupClicks() {
        this.render.canvas.addEventListener('dblclick', (event) => {
            const rect = this.render.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const bodies = Matter.Composite.allBodies(this.engine.world);
            const clickedBodies = Matter.Query.point(bodies, { x, y });

            clickedBodies.forEach(body => { if (body.label === 'weight') this.performDivision(body); });
        });
    }

    performDivision(body) {
        const val = body.logicData.value;
        const absVal = Math.abs(val);
        if (absVal <= 1) return;

        if (body.lastZone) this.logicEngine.updateWeight(body.lastZone, body.logicData.type, val, 'remove');

        let parts = [];
        const sign = Math.sign(val);
        
        if (this.divisionMode === 'atomic') {
            for(let i=0; i<absVal; i++) parts.push(1 * sign);
        } 
        else if (this.divisionMode === 'binary') {
            const half = Math.floor(absVal / 2);
            parts.push(half * sign, (absVal - half) * sign);
        }

        Matter.World.remove(this.engine.world, body);

        parts.forEach((partVal) => {
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;
            const newBody = this.weightSystem.create(body.logicData.type, body.position.x + offsetX, body.position.y + offsetY, partVal);
            Matter.Body.setVelocity(newBody, { x: offsetX * 0.1, y: -3 }); 
            Matter.World.add(this.engine.world, newBody);
        });
    }
}