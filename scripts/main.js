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

// Empêche d'annoncer la victoire en boucle pour une même équation.
let victoryAnnounced = false;

// Après une opération, on attend que la physique se stabilise puis on consigne
// l'équation résultante comme nouvelle ligne du journal, avec l'opération qui
// l'a produite (pour afficher la flèche +/−/÷).
let historyTimer = null;
let pendingOp = null;
function scheduleHistorySnapshot(op = null) {
    if (op) pendingOp = op;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
        ui.commitHistoryLine(logic.getEquationHTML(), pendingOp);
        pendingOp = null;
    }, 1000);
}

// Étiquette d'opération « ± terme » (ex. "+ 3x", "− 42", "− x").
function opLabel(type, val) {
    const sign = val >= 0 ? '+' : '−';
    const a = Math.abs(val);
    const term = type === 'X' ? (a === 1 ? 'x' : `${a}x`) : `${a}`;
    return `${sign} ${term}`;
}

// Ajoute un poids LIBRE (non posé) depuis la banque : il apparaît en haut,
// au centre, puis l'utilisateur le glisse dans le bac de son choix.
function spawnFreeWeight(type, value) {
    const x = (physics.width / 2) + (Math.random() * 120 - 60);
    const y = 80;
    const body = weightSystem.create(type, x, y, value);
    body.lastZone = null;
    Matter.World.add(physics.engine.world, body);
}

function formatSolution(value) {
    if (Number.isInteger(value)) return `${value}`;
    // Affiche une fraction lisible quand x n'est pas entier (ex: 2.5 → 5/2)
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function startNewEquation() {
    victoryAnnounced = false;
    clearTimeout(historyTimer);
    ui.clearTrash();
    logic.generateNewEquation();
    const original = logic.getEquationHTML();   // capturé avant que spawnFromLogic ne vide la logique
    spawnFromLogic();
    ui.resetHistory(original);
}

function startCustomEquation(leftStr, rightStr) {
    victoryAnnounced = false;
    clearTimeout(historyTimer);
    ui.clearTrash();
    const result = logic.loadFromStrings(leftStr, rightStr);
    const original = logic.getEquationHTML();
    spawnFromLogic();
    ui.resetHistory(original);

    if (result.type === 'impossible') {
        ui.showToast("⚠️ Équation impossible : aucune solution. La balance restera penchée.", 'warning', 5000);
    } else if (result.type === 'identity') {
        ui.showToast("♾️ Identité : tout x est solution.", 'info', 4500);
    } else if (!result.isInteger) {
        ui.showToast(`ℹ️ Solution non entière : x = ${formatSolution(result.value)}.`, 'info', 4500);
    }
}

// Quand le marteau détruit un poids, on l'affiche dans la zone du bon côté.
interactionManager.onWeightDestroyed = (zone, logicData) => ui.addToTrash(zone, logicData);

// Mode − : on glisse un poids vers la corbeille, son jumeau suit en miroir, et
// déposer les retire des deux côtés → slogan + étape de journal.
interactionManager.onSymmetricRemove = (data, symmetric) => {
    if (!data || data.value === undefined) return;
    if (symmetric) {
        ui.popSlogan("Je retire la même quantité de chaque côté");
        scheduleHistorySnapshot({ kind: data.value > 0 ? 'sub' : 'add', label: opLabel(data.type, -data.value) });
    }
};

// Aucun mode actif au démarrage : barre de pouvoirs neutre, rien d'ouvert.
// La fusion (agréger deux poids identiques) reste active hors mode spécial
// car c'est une mécanique de base du jeu.
let activeMode = null;
function applyMode(mode) {
    activeMode = mode;
    const isAdd = mode === 'add';
    const isSub = mode === 'sub';
    const isDiv = mode === 'div';
    const isHammer = mode === 'hammer';
    interactionManager.setHammerMode(isHammer);
    interactionManager.setFusionEnabled(mode === null || isAdd);
    interactionManager.setSubtractMode(isSub);
    physics.divisorPreview = 1;
    ui.setHammerActive(isHammer);
    ui.setActiveOp(mode);
    ui.setBankVisible(isAdd);
    ui.toggleCenterTrash(isSub);
    ui.setDivisionScaleVisible(isDiv);
}
function toggleMode(mode) { applyMode(activeMode === mode ? null : mode); }

// Construit la banque du pouvoir + : valeurs présentes sur la balance + leurs
// inverses, plus les unités de base (x, -x, 1, -1).
function buildAdaptiveBank() {
    const label = (type, val) => {
        const v = `${val}`.replace('-', '−');
        if (type !== 'X') return v;
        if (val === 1) return 'x';
        if (val === -1) return '−x';
        return `${v}x`;
    };
    const absValues = { X: new Set([1]), known: new Set([1]) }; // unités toujours présentes
    [...logic.state.lhs, ...logic.state.rhs].forEach(it => {
        const a = Math.abs(it.val);
        if (a > 0) absValues[it.type]?.add(a);
    });
    const items = [];
    ['X', 'known'].forEach(type => {
        [...absValues[type]].sort((a, b) => a - b).forEach(abs => {
            items.push({ type, value: abs, label: label(type, abs) });
            items.push({ type, value: -abs, label: label(type, -abs) });
        });
    });
    return items;
}

// --- LIAISONS ---
physics.onUpdateUI = () => {
    ui.updateEquationHTML(logic.getEquationHTML());
    const state = logic.calculateTiltFactor().status;
    ui.updateState(state);

    // La banque permanente s'adapte en continu au contenu de la balance.
    ui.refreshPowerBank(buildAdaptiveBank());

    const solved = logic.checkSolved();
    if (solved && !victoryAnnounced) {
        victoryAnnounced = true;
        ui.showToast(`🎉 Bravo ! Tu as isolé l'inconnue : <b>x = ${formatSolution(solved.value)}</b>`, 'success', 6000);
    } else if (!solved) {
        victoryAnnounced = false;
    }
};

ui.init({
    onSpawn: (type, val) => { },
    onNewEquation: () => startNewEquation(),
    onCustomEquation: (l, r) => startCustomEquation(l, r),
    onReset: () => window.location.reload(),
    onModeSelect: (mode) => {
        if (['add', 'sub', 'div', 'hammer'].includes(mode)) toggleMode(mode);
    },
    onConfigChange: (newConfig) => {
        logic.updateConfig(newConfig);
        startNewEquation();
    },
    // Pouvoir + : un clic dans la banque fait tomber le poids des DEUX côtés.
    onPowerAdd: (type, value) => {
        physics.addToZone('left', type, value, weightSystem, false);
        physics.addToZone('right', type, value, weightSystem, false);
        ui.popSlogan("J'ajoute la même quantité de chaque côté");
        scheduleHistorySnapshot({ kind: value >= 0 ? 'add' : 'sub', label: opLabel(type, value) });
    },
    // Échelle ÷ : aperçu (secteurs sur les poids) pendant qu'on glisse.
    onDivisorPreview: (n) => { physics.divisorPreview = n; },
    // Au relâcher : on divise les deux côtés par n, puis retour au mode +.
    onDivisorApply: (n) => {
        physics.divisorPreview = 1;
        if (n >= 2) {
            const result = logic.divideBothSides(n);
            if (result.ok) {
                victoryAnnounced = false;
                // On consigne l'équation divisée AVANT le re-spawn (sinon le journal
                // capturerait le « 0 = 0 » transitoire pendant que les poids retombent).
                const dividedHTML = logic.getEquationHTML();
                spawnFromLogic();
                ui.popSlogan("Je divise par la même quantité de chaque côté");
                ui.commitHistoryLine(dividedHTML, { kind: 'div', label: `÷ ${n}` });
            } else {
                ui.showToast(`Division impossible : tout n'est pas divisible par ${n}.`, 'warning', 4500);
            }
        }
        applyMode('add'); // l'échelle disparaît, la banque revient
    }
});

applyMode(null);
physics.onResized((saved) => {
    logic.resetCounts();
    saved.forEach(s => physics.addToZone(s.zone, s.type, s.value, weightSystem, true));
    if (physics.onUpdateUI) physics.onUpdateUI();
});
startNewEquation();