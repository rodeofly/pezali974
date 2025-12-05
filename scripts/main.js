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

// --- CORRECTION 1 : Initialisation unique ---
// Vous aviez "physics.init()" deux fois. J'ai supprimé le doublon.
physics.init(); 
// On passe 'physics' (l'objet complet) au lieu de 'physics.render'
// On garde 'logic' à la fin pour la gestion des maths
const interactionManager = new InteractionManager(physics.engine, weightSystem, physics, logic);
interactionManager.init();

let spawnTimeouts = [];

// On n'a plus besoin de getWeightsForValue pour la génération initiale !
// On garde la fonction si vous voulez l'utiliser pour le bouton "division monétaire" plus tard.

function spawnWeight(type, val, side) {
    const xOffset = side === 'left' ? -C.BALANCE.TRAY_OFFSET : C.BALANCE.TRAY_OFFSET; 
    const x = (physics.width / 2) + xOffset + (Math.random() * 40 - 20);
    const y = C.SPAWN.DROP_HEIGHT; 

    // Une seule ligne pour tout faire !
    // Note : pour X, val est le coefficient (ex: 1). Pour known, val est la masse (ex: 5).
    // La méthode 'create' de WeightSystem gère la distinction.
    const body = weightSystem.create(type, x, y, val);

    Matter.World.add(physics.engine.world, body);
}

function syncSceneToMaths() {
    spawnTimeouts.forEach(id => clearTimeout(id));
    spawnTimeouts = [];

    physics.clearWeights();
    
    // 1. On demande les paramètres abstraits (a, b, c, d)
    // Note: generateNewEquation ne remplit plus le state, elle renvoie les params
    const params = logic.generateNewEquation(); 
    
    // Le state est vide au départ (resetCounts est appelé dans generateNewEquation)
    physics.onUpdateUI(); // Affiche 0 = 0

    const queue = [];

    // --- C'EST ICI LE CHANGEMENT "FUSIONNÉ" ---
    // Gauche (aX + b)
    if (params.a > 0) queue.push({t:'X', v:params.a, s:'left'}); // Un seul bloc aX
    if (params.b > 0) queue.push({t:'known', v:params.b, s:'left'}); // Un seul bloc b

    // Droite (cX + d)
    if (params.c > 0) queue.push({t:'X', v:params.c, s:'right'});
    if (params.d > 0) queue.push({t:'known', v:params.d, s:'right'});

    // On lance la cascade (max 4 éléments comme demandé !)
    queue.forEach((item, index) => {
        const id = setTimeout(() => {
            spawnWeight(item.t, item.v, item.s);
        }, index * C.SPAWN.DELAY_BETWEEN_DROPS);
        
        spawnTimeouts.push(id);
    });
}

// Liaisons
physics.onUpdateUI = () => {
    ui.updateEquation(logic.getEquationString());
    const state = logic.calculateTiltFactor().status;
    ui.updateState(state);
};

physics.setupDragEvents(weightSystem);

ui.init({
    onSpawn: (type, val) => {
        // ... (inchangé)
        const x = physics.width / 2;
        const y = 150; 
        const safeValue = (type === 'X' && !val) ? 1 : val;
        let body;
        if (type === 'X') {
            body = weightSystem.createUnknownWeight(x, y, safeValue);
        } else {
            body = weightSystem.createKnownWeight(x, y, safeValue);
        }
        body.logicData = { type, value: safeValue };
        body.lastZone = null;
        Matter.World.add(physics.engine.world, body);
    },
    onNewEquation: () => {
        logic.generateNewEquation();
        physics.onUpdateUI();
        syncSceneToMaths(); 
    },
    onReset: () => {
        window.location.reload();
    },
    onDivisionModeChange: (mode) => {
        interactionManager.setDivisionMode(mode);
    },
    
    // --- NOUVEAU CALLBACK ---
    onConfigChange: (newConfig) => {
        console.log("Configuration reçue UI:", newConfig);
        logic.updateConfig(newConfig);
        
        // On régénère une équation tout de suite pour appliquer la difficulté
        logic.generateNewEquation();
        physics.onUpdateUI();
        syncSceneToMaths();
    }
});

// Start
logic.generateNewEquation();
physics.onUpdateUI();
syncSceneToMaths();