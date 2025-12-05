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
        // Gestion Settings
        const settingsPanel = document.getElementById('settings-panel');
        const btnSettings = document.getElementById('btn-settings');
        const closeSettings = document.getElementById('close-settings');
        const divisionSelect = document.getElementById('division-mode-select');

        btnSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
        });

        closeSettings.addEventListener('click', () => {
            settingsPanel.classList.add('hidden');
        });

        divisionSelect.addEventListener('change', (e) => {
            // On notifie le main.js ou directement l'interaction manager
            if (callbacks.onDivisionModeChange) {
                callbacks.onDivisionModeChange(e.target.value);
            }
        });
        // Bouton X
        this.btnAddX.addEventListener('click', () => {
            callbacks.onSpawn('X', null);
        });

        // Boutons Numériques
        this.numButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = parseInt(e.target.dataset.val);
                callbacks.onSpawn('known', val);
            });
        });

        // Contrôles Généraux
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