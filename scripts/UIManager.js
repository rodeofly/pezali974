export class UIManager {
    constructor() {
        this.equationEl = document.getElementById('equation-display');
        this.stateEl = document.getElementById('balance-state');
        this.btnNewEq = document.getElementById('btn-new-eq');
    }

    init(callbacks) {
        const settingsPanel = document.getElementById('settings-panel');
        const btnSettings = document.getElementById('btn-settings');
        const closeSettings = document.getElementById('close-settings');
        const divisionSelect = document.getElementById('division-mode-select');

        // SLIDERS & CONTROLS
        const inpMaxX = document.getElementById('inp-max-x');
        const lblMaxX = document.getElementById('lbl-max-x');
        const chkFixedX = document.getElementById('chk-fixed-x');
        const lblRangeTitle = document.getElementById('lbl-range-title');
        
        const inpMaxC = document.getElementById('inp-max-c');
        const lblMaxC = document.getElementById('lbl-max-c');

        const inpCustomLeft = document.getElementById('inp-custom-left');
        const inpCustomRight = document.getElementById('inp-custom-right');
        const btnLoadCustom = document.getElementById('btn-load-custom');

        btnSettings.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
        closeSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

        // --- GESTION MISE À JOUR VISUELLE X ---
        const updateXConfig = () => {
            const isFixed = chkFixedX.checked;
            
            if (isFixed) {
                if (inpMaxX.min !== "-20") { inpMaxX.min = "-20"; inpMaxX.max = "20"; }
            } else {
                if (inpMaxX.min !== "1") { 
                    inpMaxX.min = "1"; inpMaxX.max = "20"; 
                    let currentVal = parseInt(inpMaxX.value);
                    if (currentVal < 1) inpMaxX.value = Math.abs(currentVal) || 10;
                }
            }

            const val = parseInt(inpMaxX.value);

            if (isFixed) {
                lblMaxX.innerText = `${val}`; 
                lblRangeTitle.innerText = "Valeur Fixe de X : ";
                // Si on passe en mode fixe, on réactive visuellement le slider s'il était grisé
                inpMaxX.disabled = false;
                inpMaxX.style.opacity = "1";
            } else {
                lblMaxX.innerText = `[-${val}, +${val}]`;
                lblRangeTitle.innerText = "Intervalle de génération : ";
                inpMaxX.disabled = false;
                inpMaxX.style.opacity = "1";
            }

            // Envoi de la config
            if (callbacks.onConfigChange) {
                callbacks.onConfigChange({ fixedX: isFixed, targetX: val });
            }
        };

        // --- CHARGEMENT MANUEL (EXCLUSIVITÉ) ---
        btnLoadCustom.addEventListener('click', () => {
            if (callbacks.onCustomEquation) {
                // 1. On lance le chargement
                callbacks.onCustomEquation(inpCustomLeft.value, inpCustomRight.value);
                
                // 2. EXCLUSIVITÉ : On décoche "Fixer X" car l'équation dicte sa loi
                chkFixedX.checked = false;
                
                // 3. On grise le slider pour montrer qu'il est inactif pour cette équation
                inpMaxX.disabled = true;
                inpMaxX.style.opacity = "0.5";
                lblRangeTitle.innerText = "Mode Manuel (X calculé) : ";
                lblMaxX.innerText = "Auto";

                // 4. On ferme le panel
                settingsPanel.classList.add('hidden'); 
            }
        });

        divisionSelect.addEventListener('change', (e) => {
            if (callbacks.onDivisionModeChange) callbacks.onDivisionModeChange(e.target.value);
        });

        inpMaxX.addEventListener('input', updateXConfig);
        inpMaxX.addEventListener('change', updateXConfig);
        
        // IMPORTANT : Quand on clique sur la Checkbox, on redonne la main au slider
        chkFixedX.addEventListener('change', () => {
            inpMaxX.disabled = false;
            inpMaxX.style.opacity = "1";
            updateXConfig();
        });

        inpMaxC.addEventListener('input', (e) => { lblMaxC.innerText = e.target.value; });
        inpMaxC.addEventListener('change', (e) => {
            if (callbacks.onConfigChange) {
                const constRP = parseInt(e.target.value);
                const newMaxCoeff = Math.max(4, Math.floor(constRP / 4));
                callbacks.onConfigChange({ 
                    constantRange: { min: 1, max: constRP },
                    coeffRange: { min: 1, max: newMaxCoeff } 
                });
            }
        });

        // Quand on clique sur "Nouvelle Équation", on réactive les contrôles standards
        this.btnNewEq.addEventListener('click', () => {
             // On réactive le slider au cas où il était bloqué par le mode manuel
             inpMaxX.disabled = false;
             inpMaxX.style.opacity = "1";
             updateXConfig(); // Rafraîchit les labels
             
             callbacks.onNewEquation();
        });

        const inpSolver = document.getElementById('solver-input');
        const getSolverValue = () => parseInt(inpSolver.value) || 1;
        const triggerAction = (type, op) => { 
            if (callbacks.onSolverAction) callbacks.onSolverAction({ type, operation: op, value: getSolverValue() });
        };
        
        const ids = ['btn-solve-sub-c', 'btn-solve-add-c', 'btn-solve-sub-x', 'btn-solve-add-x'];
        const params = [['known','sub'], ['known','add'], ['X','sub'], ['X','add']];
        ids.forEach((id, i) => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', () => triggerAction(params[i][0], params[i][1]));
        });
    }

    updateEquationHTML(htmlString) { this.equationEl.innerHTML = htmlString; }
    updateEquation(str) { this.equationEl.innerText = str; }

    updateState(status) {
        const map = {
            'EQUILIBRIUM': { text: '⚖️ ÉQUILIBRE', color: '#2ecc71' },
            'LEFT_HEAVY': { text: '⬅️ GAUCHE TROP LOURD', color: '#e74c3c' },
            'RIGHT_HEAVY': { text: 'DROITE TROP LOURD ➡️', color: '#e74c3c' }
        };
        const current = map[status] || { text: '...', color: '#fff' };
        this.stateEl.innerText = current.text;
        this.stateEl.style.color = current.color;
    }
}