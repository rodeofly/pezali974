export class UIManager {
    constructor() {
        this.equationEl = document.getElementById('equation-display');
        this.stateEl = document.getElementById('balance-state');
        this.btnNewEq = document.getElementById('btn-new-eq');
        this.btnReset = document.getElementById('btn-reset');
        // Celui-ci correspond au bouton du menu latéral (PAS touche !)
        this.btnAddX = document.getElementById('btn-add-x'); 
        this.numButtons = document.querySelectorAll('.btn-num');
    }

    init(callbacks) {
        // --- Gestion Panel ---
        const settingsPanel = document.getElementById('settings-panel');
        const btnSettings = document.getElementById('btn-settings');
        const closeSettings = document.getElementById('close-settings');
        const divisionSelect = document.getElementById('division-mode-select');

        // SLIDERS
        const inpMaxX = document.getElementById('inp-max-x');
        const lblMaxX = document.getElementById('lbl-max-x');
        const inpMaxCoeff = document.getElementById('inp-max-coeff');
        const lblMaxCoeff = document.getElementById('lbl-max-coeff');
        const inpMaxC = document.getElementById('inp-max-c');
        const lblMaxC = document.getElementById('lbl-max-c');

        btnSettings.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
        closeSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

        divisionSelect.addEventListener('change', (e) => {
            if (callbacks.onDivisionModeChange) callbacks.onDivisionModeChange(e.target.value);
        });

        // --- SLIDER X ---
        inpMaxX.addEventListener('input', (e) => {
            lblMaxX.innerText = e.target.value; 
        });
        inpMaxX.addEventListener('change', (e) => {
            if (callbacks.onConfigChange) callbacks.onConfigChange({ maxX: parseInt(e.target.value) });
        });

        // --- SLIDER CONSTANTES ---
        inpMaxC.addEventListener('input', (e) => {
            lblMaxC.innerText = e.target.value;
        });
        inpMaxC.addEventListener('change', (e) => {
            if (callbacks.onConfigChange) {
                constRP = parseInt(e.target.value);
                const newMaxCoeff = Math.max(4, Math.floor(constRP / 4));
                callbacks.onConfigChange({ 
                    constantRange: { min: 1, max: constRP },
                    coeffRange: { min: 1, max: newMaxCoeff }
                });
            }
        });

        // --- BOUTONS CLASSIQUES (SIDEBAR) ---
        if(this.btnAddX) this.btnAddX.addEventListener('click', () => callbacks.onSpawn('X', null));
        
        this.numButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = parseInt(e.target.dataset.val);
                callbacks.onSpawn('known', val);
            });
        });
        this.btnNewEq.addEventListener('click', callbacks.onNewEquation);
        this.btnReset.addEventListener('click', callbacks.onReset);

        // --- GESTION SOLVER BAR (CORRIGÉE) ---
        const inpSolver = document.getElementById('solver-input');
        
        // On récupère les boutons avec les NOUVEAUX IDs uniques
        const btnSubC = document.getElementById('btn-solve-sub-c');
        const btnAddC = document.getElementById('btn-solve-add-c');
        const btnSubX = document.getElementById('btn-solve-sub-x');
        const btnAddX = document.getElementById('btn-solve-add-x'); // Plus de conflit ici !

        const getSolverValue = () => parseInt(inpSolver.value) || 1;

        const triggerAction = (type, operation) => { 
            if (callbacks.onSolverAction) {
                callbacks.onSolverAction({
                    type: type,
                    operation: operation,
                    value: getSolverValue()
                });
            }
        };

        // On vérifie que les boutons existent avant d'ajouter l'écouteur (sécurité)
        if(btnSubC) btnSubC.addEventListener('click', () => triggerAction('known', 'sub'));
        if(btnAddC) btnAddC.addEventListener('click', () => triggerAction('known', 'add'));
        if(btnSubX) btnSubX.addEventListener('click', () => triggerAction('X', 'sub'));
        if(btnAddX) btnAddX.addEventListener('click', () => triggerAction('X', 'add'));
    }

    updateEquation(eqString) {
        this.equationEl.innerText = eqString;
    }

    updateState(status) {
        const map = {
            'EQUILIBRIUM': { text: '⚖️ ÉQUILIBRE', color: '#2ecc71' },
            'LEFT_HEAVY': { text: '⬅️ GAUCHE TROP LOURD', color: '#e74c3c' },
            'RIGHT_HEAVY': { text: 'DROITE TROP LOURD ➡️', color: '#e74c3c' }
        };
        const current = map[status] || { text: '...', color: '#fff' };
        this.stateEl.innerText = current.text;
        this.stateEl.style.color = current.color;
        this.equationEl.style.color = status === 'EQUILIBRIUM' ? '#2ecc71' : '#ffffff';
    }
}