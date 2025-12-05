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
        this.onUpdateUI = null;
        
        // Optimisation
        this.frameCounter = 0; 
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
                background: C.COLORS.BACKGROUND, // Via Constante
                showAngleIndicator: false
            }
        });
        this.render = render;
        Events.on(render, 'afterRender', () => {
            this.renderLabels();
        });
        this.createBoundaries();
        this.createBalance('suspended'); 
        this.setupZoneMonitor(); // Version optimisée

        Render.run(render);
        const runner = Runner.create();
        Runner.run(runner, this.engine);

        Events.on(this.engine, 'beforeUpdate', () => {
            this.syncBeamAngle();
        });
    }

    /**
     * Dessine les valeurs (5, X, 2X...) sur les poids
     */
    renderLabels() {
        const context = this.render.context;
        const bodies = Composite.allBodies(this.engine.world);

        context.font = "bold 16px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "white"; // Couleur du texte

        bodies.forEach(body => {
            if (body.label === 'weight' && body.logicData) {
                const { type, value } = body.logicData;
                let text = "";
                
                if (type === 'X') {
                    text = value === 1 ? "X" : `${value}X`;
                } else {
                    text = value.toString();
                }

                // On dessine au centre du corps
                context.fillText(text, body.position.x, body.position.y);
            }
        });
    }

    createBalance(modelName) {
        if (this.beam) {
             World.clear(this.engine.world);
             this.createBoundaries();
        }
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
        
        // Sécurité Max Angle
        if (currentAngle > C.PHYSICS.MAX_ANGLE) Body.setAngle(this.beam, C.PHYSICS.MAX_ANGLE);
        if (currentAngle < -C.PHYSICS.MAX_ANGLE) Body.setAngle(this.beam, -C.PHYSICS.MAX_ANGLE);

        const diff = targetAngle - currentAngle;

        if (Math.abs(diff) < 0.005) {
            Body.setAngularVelocity(this.beam, 0);
            return;
        }
        Body.setAngularVelocity(this.beam, diff * 0.05);
    }
    
    clearWeights() {
        const bodies = Composite.allBodies(this.engine.world);
        const weights = bodies.filter(b => b.label === 'weight');
        World.remove(this.engine.world, weights);
    }

    setupDragEvents() {
        const mouse = Mouse.create(this.container);
        
        // --- MODIFICATION ICI : On stocke dans 'this' ---
        this.mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        
        World.add(this.engine.world, this.mouseConstraint);
    }
    
    // --- OPTIMISATION DU MONITEUR ---
    setupZoneMonitor() {
        Events.on(this.engine, 'afterUpdate', () => {
            // On ne vérifie que toutes les X frames (ex: 10) pour sauver du CPU
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