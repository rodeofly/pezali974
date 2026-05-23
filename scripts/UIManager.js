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

        // SLIDERS & CONTROLS — trois intervalles uniformes [min, max]
        const inpMinX = document.getElementById('inp-min-x');
        const inpMaxX = document.getElementById('inp-max-x');
        const lblXRange = document.getElementById('lbl-x-range');

        const inpMinCoeff = document.getElementById('inp-min-coeff');
        const inpMaxCoeff = document.getElementById('inp-max-coeff');
        const lblCoeffRange = document.getElementById('lbl-coeff-range');

        const inpMinC = document.getElementById('inp-min-c');
        const inpMaxC = document.getElementById('inp-max-c');
        const lblConstRange = document.getElementById('lbl-const-range');

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

        btnLoadCustom.addEventListener('click', () => {
            if (callbacks.onCustomEquation) {
                callbacks.onCustomEquation(inpCustomLeft.value, inpCustomRight.value);
                settingsPanel.classList.add('hidden');
            }
        });

        // --- Helpers génériques pour les 3 dual-sliders ---
        // Si l'utilisateur croise les deux curseurs, on rapproche l'autre d'un cran
        // pour garder min ≤ max sans bloquer le geste.
        const clampPair = (whichChanged, lowerEl, upperEl) => {
            const lo = parseInt(lowerEl.value);
            const hi = parseInt(upperEl.value);
            if (lo > hi) {
                if (whichChanged === 'lower') upperEl.value = `${lo}`;
                else lowerEl.value = `${hi}`;
            }
        };
        const fmtInt = (v) => (v < 0 ? `−${Math.abs(v)}` : `${v}`);
        const wireDualRange = (lowerEl, upperEl, lblEl, configKey) => {
            const refresh = () => {
                lblEl.innerText = `[${fmtInt(parseInt(lowerEl.value))}, ${fmtInt(parseInt(upperEl.value))}]`;
            };
            const send = () => {
                if (callbacks.onConfigChange) callbacks.onConfigChange({
                    [configKey]: { min: parseInt(lowerEl.value), max: parseInt(upperEl.value) }
                });
            };
            lowerEl.addEventListener('input', () => { clampPair('lower', lowerEl, upperEl); refresh(); });
            upperEl.addEventListener('input', () => { clampPair('upper', lowerEl, upperEl); refresh(); });
            lowerEl.addEventListener('change', send);
            upperEl.addEventListener('change', send);
            refresh();
        };

        wireDualRange(inpMinX, inpMaxX, lblXRange, 'xRange');
        wireDualRange(inpMinCoeff, inpMaxCoeff, lblCoeffRange, 'coeffRange');
        wireDualRange(inpMinC, inpMaxC, lblConstRange, 'constantRange');

        // --- Presets de cycle ---
        const applyPreset = (vals) => {
            inpMinX.value     = String(vals.xRange.min);
            inpMaxX.value     = String(vals.xRange.max);
            inpMinCoeff.value = String(vals.coeffRange.min);
            inpMaxCoeff.value = String(vals.coeffRange.max);
            inpMinC.value     = String(vals.constantRange.min);
            inpMaxC.value     = String(vals.constantRange.max);
            // Rafraîchit chaque dual-range (réutilise les listeners déjà branchés)
            [inpMinX, inpMaxX, inpMinCoeff, inpMaxCoeff, inpMinC, inpMaxC]
                .forEach(el => el.dispatchEvent(new Event('input')));
            if (callbacks.onConfigChange) callbacks.onConfigChange(vals);
        };
        const btnC3 = document.getElementById('btn-preset-cycle3');
        const btnC4 = document.getElementById('btn-preset-cycle4');
        if (btnC3) btnC3.addEventListener('click', () => applyPreset({
            xRange:        { min: 1, max: 10 },
            coeffRange:    { min: 1, max: 5 },
            constantRange: { min: 1, max: 20 },
            positiveOnly:  true
        }));
        if (btnC4) btnC4.addEventListener('click', () => applyPreset({
            xRange:        { min: -20, max: 20 },
            coeffRange:    { min: -20, max: 20 },
            constantRange: { min: -20, max: 20 },
            positiveOnly:  false
        }));

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
                if (callbacks.onModeSelect) callbacks.onModeSelect(power);
            });
        });

        // Échelle de division (mode ÷) : input = aperçu des secteurs, change = applique.
        const divSlider = document.getElementById('div-slider');
        const divN = document.getElementById('div-n');
        const divCustom = document.getElementById('div-custom');
        const divCustomApply = document.getElementById('div-custom-apply');

        const fmtSigned = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
        let currentN = 1;
        const setPreview = (n) => {
            currentN = n;
            if (divN) {
                if (n === 0) divN.innerHTML = '<span class="div-forbidden" title="Division par 0 interdite">⊘</span>';
                else divN.innerText = fmtSigned(n);
            }
            if (callbacks.onDivisorPreview) callbacks.onDivisorPreview(n);
        };
        const validate = () => {
            if (currentN !== 0 && Math.abs(currentN) >= 2 && callbacks.onDivisorApply) {
                callbacks.onDivisorApply(currentN);
            }
        };

        // Slider : APERÇU uniquement, ne valide plus au release.
        if (divSlider) {
            divSlider.addEventListener('input', () => {
                const n = parseInt(divSlider.value, 10);
                if (divCustom) divCustom.value = '';
                setPreview(n);
            });
        }

        // Champ libre : aperçu en direct, Enter = valider.
        if (divCustom) {
            divCustom.addEventListener('input', () => {
                const n = parseInt(divCustom.value, 10);
                if (!isNaN(n)) setPreview(n);
            });
            divCustom.addEventListener('keydown', (e) => { if (e.key === 'Enter') validate(); });
        }
        // Bouton « Valider » : applique le diviseur en cours (slider ou champ).
        if (divCustomApply) divCustomApply.addEventListener('click', validate);

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
    popSlogan(text, variant = '') {
        const el = document.getElementById('slogan');
        if (!el) return;
        el.innerHTML = text;
        el.classList.remove('slogan-show', 'slogan-victory');
        if (variant) el.classList.add('slogan-' + variant);
        // force le redémarrage de l'animation
        void el.offsetWidth;
        el.classList.add('slogan-show');
        clearTimeout(this._sloganTimer);
        const duration = variant === 'victory' ? 5500 : 2400;
        this._sloganTimer = setTimeout(() => el.classList.remove('slogan-show'), duration);
    }

    /** Met en évidence l'opération active parmi les boutons (banque +, −, ÷). */
    setActiveOp(mode) {
        const map = { add: 'op-add', sub: 'op-sub', div: 'op-div' };
        ['op-add', 'op-sub', 'op-div'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.classList.toggle('active', map[mode] === id);
        });
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

    /** Ajoute une ligne (résultat d'une opération op), si elle diffère de la précédente.
     *  cssClass : classe additionnelle pour styliser la ligne (ex: 'eq-solution'). */
    commitHistoryLine(htmlString, op = null, cssClass = '') {
        const last = this.history[this.history.length - 1];
        if (htmlString && (!last || htmlString !== last.html)) this.history.push({ html: htmlString, op, cssClass });
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
            const cls = (i === 0 ? ' eq-origin' : '') + (entry.cssClass ? ' ' + entry.cssClass : '');
            parts.push(`<div class="eq-line${cls}">${entry.html}</div>`);
        });
        const last = this.history[this.history.length - 1];
        // Ligne « en direct » (état courant) si elle diffère de la dernière étape
        // validée — sauf si c'est le « 0 = 0 » transitoire (plateaux vidés pendant
        // que les poids retombent), qu'on ne montre jamais.
        const liveText = this.currentLive.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (this.currentLive && liveText !== '0 = 0' && (!last || this.currentLive !== last.html)) {
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
        const zoneEl = document.getElementById(`trash-${zone}`);
        if (zoneEl) zoneEl.classList.add('has-items');
    }

    clearTrash() {
        document.querySelectorAll('.trash-items').forEach(el => { el.innerHTML = ''; });
        document.querySelectorAll('.trash-zone').forEach(el => el.classList.remove('has-items'));
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
            'EQUILIBRIUM': { dot: '⚖', title: 'Équilibre', state: 'eq' },
            'LEFT_HEAVY':  { dot: '◀', title: 'Gauche trop lourd', state: 'left' },
            'RIGHT_HEAVY': { dot: '▶', title: 'Droite trop lourd', state: 'right' }
        };
        const current = map[status] || { dot: '·', title: 'En attente', state: 'init' };
        if (!this.stateEl) return;
        this.stateEl.textContent = current.dot;
        this.stateEl.setAttribute('data-state', current.state);
        this.stateEl.setAttribute('title', current.title);
    }
}