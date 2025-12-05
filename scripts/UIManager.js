export class UIManager {
    constructor() {
        this.equationEl = document.getElementById('equation-display');
        this.stateEl = document.getElementById('balance-state');
        this.btnNewEq = document.getElementById('btn-new-eq');
        this.btnReset = document.getElementById('btn-reset');
        this.btnAddX = document.getElementById('btn-add-x');
        this.numButtons = document.querySelectorAll('.btn-num');
    }

    /**
     * Initialise les écouteurs d'événements
     * @param {Function} callbacks - { onSpawn, onNewEquation, onReset }
     */
    
    init(callbacks) {
        // --- Gestion Panel ---
        const settingsPanel = document.getElementById('settings-panel');
        const btnSettings = document.getElementById('btn-settings');
        const closeSettings = document.getElementById('close-settings');
        const divisionSelect = document.getElementById('division-mode-select');

        // SLIDERS
        const inpMaxX = document.getElementById('inp-max-x');
        const lblMaxX = document.getElementById('lbl-max-x');


        // NOUVEAU
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
            lblMaxX.innerText = e.target.value; // Mise à jour visuelle
        });
        inpMaxX.addEventListener('change', (e) => {
            // Validation et Envoi
            if (callbacks.onConfigChange) callbacks.onConfigChange({ maxX: parseInt(e.target.value) });
        });

        // --- SLIDER CONSTANTES (Gère aussi la complexité des X) ---
        inpMaxC.addEventListener('input', (e) => {
            lblMaxC.innerText = e.target.value;
        });
        inpMaxC.addEventListener('change', (e) => {
            if (callbacks.onConfigChange) {
                const val = parseInt(e.target.value);
                
                // --- AJOUT MALIN ---
                // On augmente proportionnellement le nombre de X (Coefficients)
                // Formule : 20% de la valeur des constantes, avec un minimum de 4
                const newMaxCoeff = Math.max(4, Math.floor(val / 4));

                callbacks.onConfigChange({ 
                    constantRange: { min: 1, max: val },
                    coeffRange: { min: 1, max: newMaxCoeff } // <--- C'est ça qui débloque les X !
                });
            }
        });

        // --- BOUTONS CLASSIQUES ---
        this.btnAddX.addEventListener('click', () => callbacks.onSpawn('X', null));
        this.numButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = parseInt(e.target.dataset.val);
                callbacks.onSpawn('known', val);
            });
        });
        this.btnNewEq.addEventListener('click', callbacks.onNewEquation);
        this.btnReset.addEventListener('click', callbacks.onReset);
    }

    updateEquation(eqString) {
        this.equationEl.innerText = eqString;
    }

    updateState(status) {
        // status vient de EquationEngine : 'EQUILIBRIUM', 'LEFT_HEAVY', etc.
        const map = {
            'EQUILIBRIUM': { text: '⚖️ ÉQUILIBRE', color: '#2ecc71' }, // Vert
            'LEFT_HEAVY': { text: '⬅️ GAUCHE TROP LOURD', color: '#e74c3c' }, // Rouge
            'RIGHT_HEAVY': { text: 'DROITE TROP LOURD ➡️', color: '#e74c3c' }
        };

        const current = map[status] || { text: '...', color: '#fff' };
        this.stateEl.innerText = current.text;
        this.stateEl.style.color = current.color;
        this.equationEl.style.color = status === 'EQUILIBRIUM' ? '#2ecc71' : '#ffffff';
    }
}