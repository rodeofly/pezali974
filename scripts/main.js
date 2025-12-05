import { InteractionManager } from './InteractionManager.js'; 
import { EquationEngine } from './EquationEngine.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { WeightSystem } from './WeightSystem.js';
import { UIManager } from './UIManager.js';
import { C } from './Constants.js'; 
import Matter from 'matter-js';

const logic = new EquationEngine();
const ui = new UIManager();
const physics = new PhysicsWorld('scene-container', logic);
const weightSystem = new WeightSystem();

physics.init(); 
physics.setupDragEvents(weightSystem); 

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

// Fonction corrigée pour éviter le doublon
function spawnFromLogic() {
    spawnTimeouts.forEach(id => clearTimeout(id));
    spawnTimeouts = [];
    
    // 1. On nettoie le monde physique
    physics.clearWeights();

    // 2. On prépare la file d'attente en lisant la logique générée
    const queue = [];
    logic.state.lhs.forEach(item => queue.push({ t: item.type, v: item.val, s: 'left' }));
    logic.state.rhs.forEach(item => queue.push({ t: item.type, v: item.val, s: 'right' }));

    // --- CORRECTION MAJEURE ICI ---
    // On VIDE la mémoire logique maintenant !
    // Pourquoi ? Parce que quand les objets physiques vont tomber, le ZoneMonitor 
    // va les détecter et les rajouter un par un dans l'équation.
    // Si on ne vide pas ici, on aura les objets générés + les objets détectés = doublons.
    logic.resetCounts();
    physics.onUpdateUI(); // L'équation affiche 0 = 0 temporairement (c'est normal)

    // 3. On lance la pluie
    queue.forEach((item, index) => {
        const id = setTimeout(() => {
            spawnWeight(item.t, item.v, item.s);
        }, index * C.SPAWN.DELAY_BETWEEN_DROPS);
        spawnTimeouts.push(id);
    });
}

function startNewEquation() {
    logic.generateNewEquation(); 
    spawnFromLogic();
}

function startCustomEquation(leftStr, rightStr) {
    logic.loadFromStrings(leftStr, rightStr);
    spawnFromLogic();
}

// --- LIAISONS ---
physics.onUpdateUI = () => {
    ui.updateEquationHTML(logic.getEquationHTML());
    const state = logic.calculateTiltFactor().status;
    ui.updateState(state);
};

ui.init({
    onSpawn: (type, val) => { },
    onNewEquation: () => startNewEquation(),
    onCustomEquation: (l, r) => startCustomEquation(l, r),
    onReset: () => window.location.reload(),
    onDivisionModeChange: (mode) => interactionManager.setDivisionMode(mode),
    onConfigChange: (newConfig) => { 
        logic.updateConfig(newConfig); 
        startNewEquation(); 
    },
    onSolverAction: (action) => {
        const chkInstant = document.getElementById('chk-instant-mode');
        const isInstant = chkInstant ? chkInstant.checked : false;
        if (action.operation === 'add') {
            physics.addToZone('left', action.type, action.value, weightSystem, isInstant);
            physics.addToZone('right', action.type, action.value, weightSystem, isInstant);
        } 
        else if (action.operation === 'sub') {
            physics.removeFromZone('left', action.type, action.value, weightSystem, isInstant);
            physics.removeFromZone('right', action.type, action.value, weightSystem, isInstant);
        }
    }
});

startNewEquation();