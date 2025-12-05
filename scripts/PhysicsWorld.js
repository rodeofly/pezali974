import { BalanceModels } from './BalanceModels.js';
import Matter from 'matter-js';

const { Engine, Render, Runner, World, Bodies, Body, Constraint, Mouse, MouseConstraint, Events, Composite } = Matter;

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
        this.onUpdateUI = null;
    }

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
                background: '#222831',
                showAngleIndicator: false
            }
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

    createBalance(modelName) {
        if (this.beam) {
             Matter.World.clear(this.engine.world);
             this.createBoundaries();
        }

        const model = BalanceModels[modelName](this.width/2, 140, this.width, this.height);
        this.beam = model.beam;
        this.leftTray = model.leftTray;
        this.rightTray = model.rightTray;

        // AJOUT AU MONDE (Sans ServoLink !)
        Matter.World.add(this.engine.world, model.composites);
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
        
        // 1. LIMITATEUR D'ANGLE (Sécurité absolue)
        // On empêche le fléau de dépasser ~30 degrés (0.5 rad)
        // Si la physique essaie de le tordre, on le remet de force dans les clous.
        if (currentAngle > 0.6) Body.setAngle(this.beam, 0.6);
        if (currentAngle < -0.6) Body.setAngle(this.beam, -0.6);

        // 2. CONTROLE PID SIMPLIFIÉ
        const diff = targetAngle - currentAngle;

        // Zone morte pour stopper les vibrations
        if (Math.abs(diff) < 0.005) {
            Body.setAngularVelocity(this.beam, 0);
            return;
        }

        // Vitesse douce
        const speed = diff * 0.05; 
        Body.setAngularVelocity(this.beam, speed);
    }
    
    // ... (Le reste est inchangé : clearWeights, setupDragEvents, setupZoneMonitor, detectZone) ...
    clearWeights() {
        const bodies = Composite.allBodies(this.engine.world);
        const weights = bodies.filter(b => b.label === 'weight');
        World.remove(this.engine.world, weights);
    }

    setupDragEvents() {
        const mouse = Mouse.create(this.container);
        const mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        World.add(this.engine.world, mouseConstraint);
    }
    
    setupZoneMonitor() {
        Matter.Events.on(this.engine, 'afterUpdate', () => {
            const bodies = Matter.Composite.allBodies(this.engine.world);
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