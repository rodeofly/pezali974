export class UIManager {
    constructor() {
        this.equationEl = document.getElementById('equation-display');
        this.stateEl = document.getElementById('balance-state');
        this.btnNewEq = document.getElementById('btn-new-eq');

        // Journal de résolution : équation de départ + une ligne par opération.
        this.history = [];
        this.currentLive = '';
    }

    init(callbacks) {
        const settingsPanel = document.getElementById('settings-panel');
        const btnSettings = document.getElementById('btn-settings');
        const closeSettings = document.getElementById('close-settings');

        // SLIDERS & CONTROLS
        const inpMaxX = document.getElementById('inp-max-x');
        const lblMaxX = document.getElementById('lbl-max-x');
        const chkFixedX = document.getElementById('chk-fixed-x');
        const lblRangeTitle = document.getElementById('lbl-range-title');

        const inpMaxCoeff = document.getElementById('inp-max-coeff');
        const lblMaxCoeff = document.getElementById('lbl-max-coeff');

        const inpMaxC = document.getElementById('inp-max-c');
        const lblMaxC = document.getElementById('lbl-max-c');

        const inpCustomLeft = document.getElementById('inp-custom-left');
        const inpCustomRight = document.getElementById('inp-custom-right');
        const btnLoadCustom = document.getElementById('btn-load-custom');

        btnSettings.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
        closeSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

        // --- AIDE / TUTORIEL ---
        const helpPanel = document.getElementById('help-panel');
        const btnHelp = document.getElementById('btn-help');
        const closeHelp = document.getElementById('close-help');
        if (btnHelp && helpPanel) btnHelp.addEventListener('click', () => helpPanel.classList.remove('hidden'));
        if (closeHelp && helpPanel) closeHelp.addEventListener('click', () => helpPanel.classList.add('hidden'));

        // --- PLEIN ÉCRAN ---
        const btnFs = document.getElementById('btn-fullscreen');
        if (btnFs) {
            btnFs.addEventListener('click', () => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
                else document.exitFullscreen?.();
            });
            document.addEventListener('fullscreenchange', () => {
                const on = !!document.fullscreenElement;
                btnFs.classList.toggle('active', on);
                btnFs.title = on ? 'Quitter le plein écran' : 'Plein écran';
            });
        }
        // Le marteau (déplacé dans la barre) passe par le routage des boutons de pouvoir.

        // --- BANQUE DE POIDS ---
        document.querySelectorAll('#weight-bank .bank-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const value = parseInt(item.dataset.val, 10);
                if (callbacks.onBankAdd) callbacks.onBankAdd(type, value);
            });
        });

        // Fermer les panneaux avec la touche Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                settingsPanel.classList.add('hidden');
                if (helpPanel) helpPanel.classList.add('hidden');
            }
        });

        // --- RÉGLAGE DE x : fixé à une valeur, ou tiré dans un intervalle [−N, +N] ---
        const refreshXLabels = () => {
            const isFixed = chkFixedX.checked;
            // Mode fixe : x ∈ [−20, 20]. Mode intervalle : N ∈ [1, 20].
            if (isFixed && inpMaxX.min !== "-20") { inpMaxX.min = "-20"; inpMaxX.max = "20"; }
            if (!isFixed && inpMaxX.min !== "1") {
                inpMaxX.min = "1"; inpMaxX.max = "20";
                if (parseInt(inpMaxX.value) < 1) inpMaxX.value = "10";
            }
            const val = parseInt(inpMaxX.value);
            lblRangeTitle.innerHTML = isFixed ? "Valeur de <i>x</i> :" : "Intervalle de <i>x</i> :";
            lblMaxX.innerText = isFixed ? `${val}` : `[−${val}, +${val}]`;
        };
        const sendXConfig = () => {
            refreshXLabels();
            if (callbacks.onConfigChange) callbacks.onConfigChange({ fixedX: chkFixedX.checked, targetX: parseInt(inpMaxX.value) });
        };

        btnLoadCustom.addEventListener('click', () => {
            if (callbacks.onCustomEquation) {
                callbacks.onCustomEquation(inpCustomLeft.value, inpCustomRight.value);
                settingsPanel.classList.add('hidden');
            }
        });

        // x : label en direct (input), application à la fin (change)
        inpMaxX.addEventListener('input', refreshXLabels);
        inpMaxX.addEventListener('change', sendXConfig);
        chkFixedX.addEventListener('change', sendXConfig);

        // Coefficient max de x (a, c dans ax + b = cx + d)
        inpMaxCoeff.addEventListener('input', () => { lblMaxCoeff.innerText = inpMaxCoeff.value; });
        inpMaxCoeff.addEventListener('change', () => {
            if (callbacks.onConfigChange) callbacks.onConfigChange({ coeffRange: { min: 1, max: parseInt(inpMaxCoeff.value) } });
        });

        // Constante max (b, d)
        inpMaxC.addEventListener('input', () => { lblMaxC.innerText = inpMaxC.value; });
        inpMaxC.addEventListener('change', () => {
            if (callbacks.onConfigChange) callbacks.onConfigChange({ constantRange: { min: 1, max: parseInt(inpMaxC.value) } });
        });

        this.btnNewEq.addEventListener('click', () => callbacks.onNewEquation());

        // --- SUPER-POUVOIRS (− mode à invoquer, ÷ coup ponctuel, × à venir) ---
        this.powerButtons = document.querySelectorAll('.btn-power');
        this.powerButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const power = btn.dataset.power;
                if (power === 'mul') {
                    this.showToast("✖️ Pouvoir × : bientôt disponible.", 'info');
                    return;
                }
                if (power === 'toggle') {
                    if (callbacks.onToggleAddSub) callbacks.onToggleAddSub();
                    return;
                }
                if (callbacks.onModeSelect) callbacks.onModeSelect(power);
            });
        });

        // Échelle de division (mode ÷) : input = aperçu des secteurs, change = applique.
        const divSlider = document.getElementById('div-slider');
        const divN = document.getElementById('div-n');
        if (divSlider) {
            divSlider.addEventListener('input', () => {
                const n = parseInt(divSlider.value, 10);
                if (divN) divN.innerText = `${n}`;
                if (callbacks.onDivisorPreview) callbacks.onDivisorPreview(n);
            });
            divSlider.addEventListener('change', () => {
                if (callbacks.onDivisorApply) callbacks.onDivisorApply(parseInt(divSlider.value, 10));
            });
        }

        // Clic sur un poids de la banque adaptative → ajout des deux côtés.
        this.powerBankItems = document.querySelector('#power-bank .power-bank-items');
        if (this.powerBankItems) {
            this.powerBankItems.addEventListener('click', (e) => {
                const chip = e.target.closest('.power-chip');
                if (!chip || !callbacks.onPowerAdd) return;
                callbacks.onPowerAdd(chip.dataset.type, parseInt(chip.dataset.val, 10));
            });
        }
    }

    /** Reflète le pouvoir actif sur les boutons (+ / −). */
    setPowerActive(power) {
        if (!this.powerButtons) return;
        this.powerButtons.forEach(btn => {
            const on = btn.dataset.power === power;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', String(on));
        });
    }

    /** Met à jour la banque permanente (dynamique). items: [{type, value, label}]. */
    refreshPowerBank(items) {
        if (!this.powerBankItems) return;
        const sig = items.map(i => `${i.type}:${i.value}`).join('|');
        if (this._bankSig === sig) return; // évite de reconstruire le DOM inutilement
        this._bankSig = sig;

        // Une colonne par valeur : le positif au-dessus, son opposé au-dessous.
        const cols = new Map();
        items.forEach(i => {
            const key = `${i.type}:${Math.abs(i.value)}`;
            if (!cols.has(key)) cols.set(key, {});
            cols.get(key)[i.value >= 0 ? 'pos' : 'neg'] = i;
        });
        const chip = (i) => {
            if (!i) return '';
            const neg = i.value < 0 ? ' negative' : '';
            const shape = i.type === 'X' ? 'square' : 'circle';
            return `<button class="power-chip ${shape}${neg}" data-type="${i.type}" data-val="${i.value}">${i.label}</button>`;
        };
        this.powerBankItems.innerHTML = [...cols.values()]
            .map(c => `<div class="bank-col">${chip(c.pos)}${chip(c.neg)}</div>`)
            .join('');
    }

    toggleCenterTrash(show) {
        const t = document.getElementById('center-trash');
        if (t) t.classList.toggle('hidden', !show);
    }

    /** Affiche/masque l'échelle de division (mode ÷) et la remet à 1. */
    setDivisionScaleVisible(show) {
        const el = document.getElementById('division-scale');
        if (el) el.classList.toggle('hidden', !show);
        if (show) {
            const slider = document.getElementById('div-slider');
            const lbl = document.getElementById('div-n');
            if (slider) slider.value = "1";
            if (lbl) lbl.innerText = "1";
        }
    }

    /** Affiche un slogan qui « pop » au centre (usage éclairé d'un super-pouvoir). */
    popSlogan(text) {
        const el = document.getElementById('slogan');
        if (!el) return;
        el.textContent = text;
        el.classList.remove('slogan-show');
        // force le redémarrage de l'animation
        void el.offsetWidth;
        el.classList.add('slogan-show');
        clearTimeout(this._sloganTimer);
        this._sloganTimer = setTimeout(() => el.classList.remove('slogan-show'), 2400);
    }

    /** Le bouton de la barre affiche le mode COURANT : + en mode +, − en mode −. */
    setToggleLabel(mode) {
        const btn = document.getElementById('power-toggle-bar');
        if (!btn) return;
        const showPlus = (mode !== 'sub'); // mode + (défaut) → affiche +
        btn.textContent = showPlus ? '＋' : '−';
        btn.classList.toggle('as-plus', showPlus);
        btn.classList.toggle('as-minus', !showPlus);
    }

    /** Affiche/masque la banque (masquée en mode −, remplacée par la corbeille). */
    setBankVisible(on) {
        const bank = document.getElementById('power-bank');
        if (bank) bank.classList.toggle('hidden', !on);
    }


    /** Reflète l'état du mode marteau sur son bouton + le curseur. */
    setHammerActive(on) {
        const btn = document.getElementById('btn-hammer');
        if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', String(on)); }
        document.body.classList.toggle('hammer-active', on);
    }

    // Met à jour l'état « courant » (ligne du bas, en direct) du journal.
    updateEquationHTML(htmlString) {
        this.currentLive = htmlString;
        this.renderEquation();
    }

    /** Réinitialise le journal avec l'équation de départ. */
    resetHistory(originalHTML) {
        this.history = [{ html: originalHTML, op: null }];
        this.currentLive = originalHTML;
        this.renderEquation();
    }

    /** Ajoute une ligne (résultat d'une opération op), si elle diffère de la précédente. */
    commitHistoryLine(htmlString, op = null) {
        const last = this.history[this.history.length - 1];
        if (htmlString && (!last || htmlString !== last.html)) this.history.push({ html: htmlString, op });
        this.currentLive = htmlString;
        this.renderEquation();
    }

    /** Rangée de flèches latérales courbes indiquant l'opération entre deux lignes. */
    renderOpRow(op) {
        // label à GAUCHE de la flèche gauche, et à DROITE de la flèche droite.
        return `<div class="eq-op eq-op-${op.kind}">
            <span class="eq-op-side"><span class="eq-op-label">${op.label}</span><span class="eq-arrow">↓</span></span>
            <span class="eq-op-side"><span class="eq-arrow">↓</span><span class="eq-op-label">${op.label}</span></span>
        </div>`;
    }

    renderEquation() {
        const parts = [];
        this.history.forEach((entry, i) => {
            if (i > 0 && entry.op) parts.push(this.renderOpRow(entry.op));
            parts.push(`<div class="eq-line${i === 0 ? ' eq-origin' : ''}">${entry.html}</div>`);
        });
        const last = this.history[this.history.length - 1];
        // Ligne « en direct » (état courant) si elle diffère de la dernière étape validée.
        if (this.currentLive && (!last || this.currentLive !== last.html)) {
            parts.push(`<div class="eq-line eq-current">${this.currentLive}</div>`);
        }
        this.equationEl.innerHTML = parts.join('');
        this.equationEl.scrollTop = this.equationEl.scrollHeight;
    }

    /** Formate un poids pour l'affichage (ex: {X,2}→"2x", {X,-1}→"-x", {known,3}→"3"). */
    formatWeight({ type, value }) {
        if (type !== 'X') return `${value}`;
        if (value === 1) return 'x';
        if (value === -1) return '-x';
        return `${value}x`;
    }

    /** Ajoute un poids détruit dans la zone du côté correspondant. */
    addToTrash(zone, logicData) {
        const container = document.querySelector(`#trash-${zone} .trash-items`);
        if (!container) return;
        const chip = document.createElement('span');
        chip.className = 'trash-chip' + (logicData.value < 0 ? ' negative' : '');
        chip.textContent = this.formatWeight(logicData);
        container.appendChild(chip);
        container.scrollTop = container.scrollHeight;
    }

    /** Vide les deux zones « détruits » (nouvelle équation). */
    clearTrash() {
        document.querySelectorAll('.trash-items').forEach(el => { el.innerHTML = ''; });
    }

    /**
     * Affiche une notification temporaire (toast).
     * @param {string} message - Texte (HTML autorisé).
     * @param {'info'|'success'|'warning'|'error'} type
     * @param {number} duration - Durée en ms avant disparition.
     */
    showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = message;
        container.appendChild(toast);
        // Forcer le reflow pour déclencher la transition d'entrée
        requestAnimationFrame(() => toast.classList.add('toast-show'));
        setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
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
    }
}