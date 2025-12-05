import { InteractionManager } from './InteractionManager.js'; 
import { EquationEngine } from './EquationEngine.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { WeightSystem } from './WeightSystem.js';
import { UIManager } from './UIManager.js';
import { C } from './Constants.js'; 
import Matter from 'matter-js';

// --- 1. INITIALISATION DES CLASSES ---
const logic = new EquationEngine();
const ui = new UIManager();
// On passe 'logic' au monde physique pour qu'ils puissent communiquer
const physics = new PhysicsWorld('scene-container', logic);
const weightSystem = new WeightSystem();

physics.init(); 

// Le gestionnaire d'interaction lie tout le monde ensemble
const interactionManager = new InteractionManager(physics.engine, weightSystem, physics, logic);
interactionManager.init();

// Variable pour gérer les délais d'apparition (pour pouvoir les annuler)
let spawnTimeouts = [];

// --- 2. FONCTIONS UTILITAIRES ---

// Fonction pour faire apparaître un poids physique
function spawnWeight(type, val, side) {
    const xOffset = side === 'left' ? -C.BALANCE.TRAY_OFFSET : C.BALANCE.TRAY_OFFSET; 
    // Légère variation aléatoire en X pour que ça ne s'empile pas trop droit
    const x = (physics.width / 2) + xOffset + (Math.random() * 40 - 20);
    const y = C.SPAWN.DROP_HEIGHT; 

    // Sécurité : Si type est 'X' mais value indéfinie, on met 1
    const safeValue = (type === 'X' && !val) ? 1 : val;

    const body = weightSystem.create(type, x, y, safeValue);
    Matter.World.add(physics.engine.world, body);
}

// Fonction principale : Nouvelle Équation (Remplace ton ancienne logique syncSceneToMaths)
function startNewEquation() {
    console.log("Démarrage d'une nouvelle équation...");

    // A. Annuler les objets qui sont en train d'attendre de tomber
    spawnTimeouts.forEach(id => clearTimeout(id));
    spawnTimeouts = [];

    // B. Nettoyer la scène physique existante
    physics.clearWeights();
    
    // C. Générer la nouvelle équation dans le moteur logique
    const params = logic.generateNewEquation(); 
    
    // D. Mettre à jour l'affichage du texte (UI)
    physics.onUpdateUI(); 

    // E. Préparer les objets à faire tomber
    const queue = [];

    // Côté Gauche (aX + b)
    if (params.a > 0) queue.push({t:'X', v:params.a, s:'left'}); 
    if (params.b > 0) queue.push({t:'known', v:params.b, s:'left'}); 

    // Côté Droit (cX + d)
    if (params.c > 0) queue.push({t:'X', v:params.c, s:'right'});
    if (params.d > 0) queue.push({t:'known', v:params.d, s:'right'});

    // F. Lancer la chute des objets avec un petit délai entre chaque
    queue.forEach((item, index) => {
        const id = setTimeout(() => {
            spawnWeight(item.t, item.v, item.s);
        }, index * C.SPAWN.DELAY_BETWEEN_DROPS);
        spawnTimeouts.push(id);
    });
}

// --- 3. LIAISONS (CALLBACKS) ---

// Appelé quand la physique change (pour mettre à jour le texte)
physics.onUpdateUI = () => {
    ui.updateEquation(logic.getEquationString());
    const state = logic.calculateTiltFactor().status;
    ui.updateState(state);
};

// Active le drag & drop
physics.setupDragEvents(weightSystem);

// Configuration de l'Interface Utilisateur (Boutons, etc.)
ui.init({
    // Appelé quand on glisse un objet depuis le menu (si utilisé)
    onSpawn: (type, val) => {
        const x = physics.width / 2;
        const y = 150; 
        const safeValue = (type === 'X' && !val) ? 1 : val;
        
        const body = weightSystem.create(type, x, y, safeValue);
        body.logicData = { type, value: safeValue };
        Matter.World.add(physics.engine.world, body);
    },
    
    // CORRECTION "Nouvelle Équation" : On appelle la fonction définie plus haut
    onNewEquation: () => { 
        startNewEquation(); 
    },

    onReset: () => { window.location.reload(); },
    
    onDivisionModeChange: (mode) => { interactionManager.setDivisionMode(mode); },
    
    onConfigChange: (newConfig) => { 
        logic.updateConfig(newConfig); 
        startNewEquation(); 
    },

    // --- CŒUR DU PROBLÈME RÉSOLU : SOLVER & MODE RAPIDE ---
    onSolverAction: (action) => {
        // action contient { type, value, operation, side }

        // 1. On récupère l'état de TA checkbox grâce à son ID précis
        const chkInstant = document.getElementById('chk-instant-mode');
        const isInstant = chkInstant ? chkInstant.checked : false;

        console.log(`Action Solver: ${action.operation} ${action.type} (Mode Rapide: ${isInstant})`);

        // 2. On exécute l'action via PhysicsWorld
        if (action.operation === 'add') {
            // Si le bouton spécifie un côté (gauche/droite), on l'utilise. Sinon on ajoute des deux côtés.
            if (action.side) {
                physics.addToZone(action.side, action.type, action.value, weightSystem, isInstant);
            } else {
                // Boutons centraux (+x, +1) -> Ajout des deux côtés
                physics.addToZone('left', action.type, action.value, weightSystem, isInstant);
                physics.addToZone('right', action.type, action.value, weightSystem, isInstant);
            }
        } 
        else if (action.operation === 'sub') {
            if (action.side) {
                physics.removeFromZone(action.side, action.type, action.value, weightSystem, isInstant);
            } else {
                // Boutons centraux (-x, -1) -> Retrait des deux côtés
                physics.removeFromZone('left', action.type, action.value, weightSystem, isInstant);
                physics.removeFromZone('right', action.type, action.value, weightSystem, isInstant);
            }
        }
    }
});

// --- 4. DÉMARRAGE ---
// Lance la première équation au chargement de la page
startNewEquation();