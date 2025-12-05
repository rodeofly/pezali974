import { EquationEngine } from './EquationEngine.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { WeightSystem } from './WeightSystem.js';
import { UIManager } from './UIManager.js';
import Matter from 'matter-js';

const logic = new EquationEngine();
const ui = new UIManager();
const physics = new PhysicsWorld('scene-container', logic);
const weightSystem = new WeightSystem();

physics.init();

// --- CORRECTION 1 : SUPPRIMER CETTE LIGNE ---
// physics.setupAutoCleanup(weightSystem); <--- À SUPPRIMER !
// Le ZoneMonitor s'occupe déjà de tout. Si on garde ça, on aura des bugs de comptage.

function getWeightsForValue(value) {
    // ... (inchangé)
    const available = [10, 5, 2, 1];
    const result = [];
    let remaining = value;
    for (let w of available) {
        while (remaining >= w) {
            result.push(w);
            remaining -= w;
        }
    }
    return result;
}

function spawnWeight(type, val, side) {
    // Ecartement maximum (les pivots sont à 300, on vise 280)
    const xOffset = side === 'left' ? -280 : 280;    const x = (physics.width / 2) + xOffset + (Math.random() * 30 - 15);
    
    // On spawn plus bas car les plateaux pendent
    // physics.height / 2 est une bonne approximation pour une balance suspendue
    const y = physics.height / 2 - 100;

    let body;
    if (type === 'X') {
        body = weightSystem.createUnknownWeight(x, y);
    } else {
        body = weightSystem.createKnownWeight(x, y, val);
    }

    body.logicData = { type, value: val }; 
    body.lastZone = null; 

    Matter.World.add(physics.engine.world, body);
}

// --- 3. SYNC SCENE ---
function syncSceneToMaths() {
    // 1. On vide la scène physique
    physics.clearWeights();
    
    // 2. RECETTE (CORRECTION ICI)
    // On doit COPIER l'état (JSON.stringify) pour briser le lien de référence.
    // Sinon, quand on fait resetCounts juste après, targetState devient vide aussi !
    const targetState = JSON.parse(JSON.stringify(logic.state)); 
    
    // 3. On remet les compteurs LOGIQUES à zéro pour le WYSIWYG
    logic.resetCounts();
    physics.onUpdateUI(); // Affiche 0=0

    // 4. On prépare la file d'attente en utilisant la COPIE (targetState)
    const queue = [];

    // Remplissage Gauche
    for (let i = 0; i < targetState.lhs.xCount; i++) queue.push({t:'X', v:null, s:'left'});
    getWeightsForValue(targetState.lhs.constant).forEach(v => queue.push({t:'known', v:v, s:'left'}));

    // Remplissage Droite
    for (let i = 0; i < targetState.rhs.xCount; i++) queue.push({t:'X', v:null, s:'right'});
    getWeightsForValue(targetState.rhs.constant).forEach(v => queue.push({t:'known', v:v, s:'right'}));

    // 5. Lancement de la cascade
    queue.forEach((item, index) => {
        setTimeout(() => {
            spawnWeight(item.t, item.v, item.s);
        }, index * 200); // 200ms pour bien espacer et éviter les collisions
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
        // Spawn manuel : on fait apparaître au centre-haut
        const x = physics.width / 2;
        const y = 150; // Assez haut pour ne pas gêner
        
        let body;
        if (type === 'X') {
            body = weightSystem.createUnknownWeight(x, y);
        } else {
            body = weightSystem.createKnownWeight(x, y, val);
        }

        // --- C'EST ICI QUE ÇA MANQUAIT ---
        // On attache la carte d'identité du poids pour que la balance le reconnaisse
        body.logicData = { type, value: val };
        body.lastZone = null; 
        // ---------------------------------

        Matter.World.add(physics.engine.world, body);
    },
    onNewEquation: () => {
        logic.generateNewEquation();
        physics.onUpdateUI();
        syncSceneToMaths(); 
    },
    onReset: () => {
        window.location.reload();
    }
});

// Démarrage
logic.generateNewEquation();
physics.onUpdateUI();
syncSceneToMaths();