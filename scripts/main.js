import { InteractionManager } from './InteractionManager.js'; 
import { EquationEngine } from './EquationEngine.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { WeightSystem } from './WeightSystem.js';
import { UIManager } from './UIManager.js';
import { C } from './Constants.js'; 
import Matter from 'matter-js';

// --- INITIALISATION ---
const logic = new EquationEngine();
const ui = new UIManager();
const physics = new PhysicsWorld('scene-container', logic);
const weightSystem = new WeightSystem();

physics.init(); 

const interactionManager = new InteractionManager(physics.engine, weightSystem, physics, logic);
interactionManager.init();

let spawnTimeouts = [];

function spawnWeight(type, val, side) {
    const xOffset = side === 'left' ? -C.BALANCE.TRAY_OFFSET : C.BALANCE.TRAY_OFFSET; 
    const x = (physics.width / 2) + xOffset + (Math.random() * 40 - 20);
    const y = C.SPAWN.DROP_HEIGHT; 

    const safeValue = (type === 'X' && !val) ? 1 : val;

    const body = weightSystem.create(type, x, y, safeValue);
    Matter.World.add(physics.engine.world, body);
}

function startNewEquation() {
    console.log("Nouvelle équation...");
    spawnTimeouts.forEach(id => clearTimeout(id));
    spawnTimeouts = [];
    physics.clearWeights();
    const params = logic.generateNewEquation(); 
    physics.onUpdateUI(); 

    const queue = [];
    if (params.a > 0) queue.push({t:'X', v:params.a, s:'left'}); 
    if (params.b > 0) queue.push({t:'known', v:params.b, s:'left'}); 
    if (params.c > 0) queue.push({t:'X', v:params.c, s:'right'});
    if (params.d > 0) queue.push({t:'known', v:params.d, s:'right'});

    queue.forEach((item, index) => {
        const id = setTimeout(() => {
            spawnWeight(item.t, item.v, item.s);
        }, index * C.SPAWN.DELAY_BETWEEN_DROPS);
        spawnTimeouts.push(id);
    });
}

// --- LIAISONS ---
physics.onUpdateUI = () => {
    ui.updateEquation(logic.getEquationString());
    const state = logic.calculateTiltFactor().status;
    ui.updateState(state);
};

physics.setupDragEvents(weightSystem);

ui.init({
    onSpawn: (type, val) => {
        const x = physics.width / 2;
        const y = 150; 
        const safeValue = (type === 'X' && !val) ? 1 : val;
        const body = weightSystem.create(type, x, y, safeValue);
        body.logicData = { type, value: safeValue };
        Matter.World.add(physics.engine.world, body);
    },
    
    onNewEquation: () => startNewEquation(),
    onReset: () => window.location.reload(),
    onDivisionModeChange: (mode) => interactionManager.setDivisionMode(mode),
    onConfigChange: (newConfig) => { 
        logic.updateConfig(newConfig); 
        startNewEquation(); 
    },

    // --- CŒUR DE L'INTERACTION SOLVER ---
    onSolverAction: (action) => {
        // 1. Checkbox "Mode Rapide"
        const chkInstant = document.getElementById('chk-instant-mode');
        const isInstant = chkInstant ? chkInstant.checked : false;

        console.log(`Action Solver: ${action.operation} ${action.value}${action.type} (Instant: ${isInstant})`);

        // 2. Application sur la physique
        if (action.operation === 'add') {
            // On ajoute des DEUX CÔTÉS pour garder l'équilibre de l'équation
            physics.addToZone('left', action.type, action.value, weightSystem, isInstant);
            physics.addToZone('right', action.type, action.value, weightSystem, isInstant);
        } 
        else if (action.operation === 'sub') {
            // On retire des DEUX CÔTÉS
            physics.removeFromZone('left', action.type, action.value, weightSystem, isInstant);
            physics.removeFromZone('right', action.type, action.value, weightSystem, isInstant);
        }
    }
});

startNewEquation();