export class EquationEngine {
  constructor() {
    this.state = { lhs: [], rhs: [], xValue: 0 };
    this.config = {
      xRange: { min: 1, max: 10 },
      coeffRange: { min: 1, max: 5 },
      constantRange: { min: 1, max: 20 }
    };
  }

  // --- PARSER INTELLIGENT & SOLVER ---
  loadFromStrings(leftStr, rightStr) {
      this.resetCounts();

      // 1. Fonction pour extraire les coefficients (ax + b) d'une chaîne
      const parseSide = (str) => {
          // Nettoyage et découpage
          const terms = str.replace(/\s+/g, '').match(/([+-]?[^-+]+)/g) || [];
          const result = [];
          
          let totalX = 0; // Somme des coefficients de X (le 'a')
          let totalC = 0; // Somme des constantes (le 'b')

          terms.forEach(term => {
              const lower = term.toLowerCase();
              if (lower.includes('x')) {
                  // C'est un X
                  let valStr = lower.replace('x', '');
                  if (valStr === '' || valStr === '+') valStr = '1';
                  else if (valStr === '-') valStr = '-1';
                  
                  const val = parseInt(valStr);
                  result.push({ type: 'X', val: val });
                  totalX += val;
              } else {
                  // C'est une constante
                  const val = parseInt(term);
                  result.push({ type: 'known', val: val });
                  totalC += val;
              }
          });
          return { list: result, sumX: totalX, sumC: totalC };
      };

      // 2. Analyse des deux côtés
      const leftData = parseSide(leftStr);
      const rightData = parseSide(rightStr);

      this.state.lhs = leftData.list;
      this.state.rhs = rightData.list;

      // 3. RÉSOLUTION MATHÉMATIQUE : ax + b = cx + d
      // On veut trouver x tel que : (a - c)x = d - b
      // Donc x = (d - b) / (a - c)
      
      const a = leftData.sumX;
      const b = leftData.sumC;
      const c = rightData.sumX;
      const d = rightData.sumC;

      const deltaCoeff = a - c;
      const deltaConst = d - b;

      if (deltaCoeff !== 0) {
          // Cas normal : Solution unique.
          // On garde la valeur EXACTE (flottant) pour que la balance reflète
          // fidèlement l'équation, même si x n'est pas entier (ex: 2x = 5 → x = 2.5).
          this.state.xValue = deltaConst / deltaCoeff;
          return { type: 'unique', value: this.state.xValue, isInteger: Number.isInteger(this.state.xValue) };
      }

      // Cas parallèle (a = c)
      if (deltaConst === 0) {
          // 2x + 5 = 2x + 5 (Toujours vrai). X peut être n'importe quoi.
          this.state.xValue = 10;
          return { type: 'identity', value: null, isInteger: true };
      }
      // 2x + 5 = 2x + 10 (Impossible). On fixe une valeur arbitraire, la balance penchera.
      this.state.xValue = 10;
      return { type: 'impossible', value: null, isInteger: true };
  }

  // --- GÉNÉRATION AUTOMATIQUE ---
  generateNewEquation() {
    const xMin = this.config.xRange.min;
    const xMax = this.config.xRange.max;
    const minCoeff = this.config.coeffRange.min;
    const maxCoeff = this.config.coeffRange.max;
    const minC = this.config.constantRange.min;
    const maxC = this.config.constantRange.max;

    // x ≠ 0 (sinon il n'y a pas d'inconnue à isoler). Si l'intervalle ne
    // contient que 0, on rabat sur 1.
    let x;
    if (xMin === 0 && xMax === 0) {
        x = 1;
    } else {
        let tries = 0;
        do { x = this.randomInt(xMin, xMax); tries++; }
        while (x === 0 && tries < 50);
        if (x === 0) x = xMax > 0 ? 1 : -1;
    }

    // a et c : différents (sinon pas de solution unique) et pas tous deux nuls
    // (sinon plus aucune inconnue dans l'équation).
    let a, c;
    let tries = 0;
    do {
        a = this.randomInt(minCoeff, maxCoeff);
        c = this.randomInt(minCoeff, maxCoeff);
        tries++;
    } while ((a === c || (a === 0 && c === 0)) && tries < 100);
    if (a === c) c = a + (a < maxCoeff ? 1 : -1);
    if (a === 0 && c === 0) a = 1;

    const b = this.randomInt(minC, maxC);
    const d = (a * x) + b - (c * x);

    this.state.xValue = x;
    this.resetCounts();

    if (a !== 0) this.updateWeight('left', 'X', a);
    if (b !== 0) this.updateWeight('left', 'known', b);
    if (c !== 0) this.updateWeight('right', 'X', c);
    if (d !== 0) this.updateWeight('right', 'known', d);

    return { a, b, c, d };
  }

  resetCounts() { this.state.lhs = []; this.state.rhs = []; }

  /** Somme signée des poids d'un type ('X' ou 'known') sur un côté ('left'/'right'). */
  sumSideByType(side, type) {
    const list = side === 'left' ? this.state.lhs : this.state.rhs;
    return list.reduce((sum, item) => (item.type === type ? sum + item.val : sum), 0);
  }

  /**
   * Divise les DEUX côtés par n (principe d'égalité). N'est autorisé que si
   * tous les poids (coefficients de x et constantes) sont divisibles par n,
   * pour rester dans le monde des nombres entiers du jeu.
   * Reconstruit chaque côté en blocs agrégés. Retourne { ok, reason }.
   */
  divideBothSides(n) {
    if (!Number.isInteger(n) || n < 2) return { ok: false, reason: 'invalid' };

    const aggregate = (list) => list.reduce((acc, item) => {
        if (item.type === 'X') acc.x += item.val; else acc.c += item.val;
        return acc;
    }, { x: 0, c: 0 });

    const L = aggregate(this.state.lhs);
    const R = aggregate(this.state.rhs);

    const divisible = [L.x, L.c, R.x, R.c].every(v => v % n === 0);
    if (!divisible) return { ok: false, reason: 'not-divisible' };

    this.resetCounts();
    if (L.x / n !== 0) this.updateWeight('left', 'X', L.x / n);
    if (L.c / n !== 0) this.updateWeight('left', 'known', L.c / n);
    if (R.x / n !== 0) this.updateWeight('right', 'X', R.x / n);
    if (R.c / n !== 0) this.updateWeight('right', 'known', R.c / n);

    return { ok: true };
  }

  updateWeight(side, type, value, operation = 'add') {
    const list = side === 'left' ? this.state.lhs : this.state.rhs;
    if (operation === 'add') {
        list.push({ type, val: value });
    } else {
        const index = list.findIndex(item => item.type === type && item.val === value);
        if (index !== -1) list.splice(index, 1);
    }
  }

  calculateTiltFactor() {
    const sumSide = (list) => list.reduce((acc, item) => {
        const mass = item.type === 'X' ? (item.val * this.state.xValue) : item.val;
        return acc + mass;
    }, 0);
    const leftMass = sumSide(this.state.lhs);
    const rightMass = sumSide(this.state.rhs);
    const delta = leftMass - rightMass;
    
    const maxTilt = 0.6; 
    const sensitivity = 0.05;
    const targetAngle = Math.max(Math.min(delta * -sensitivity, maxTilt), -maxTilt);
    
    return { delta, targetAngle, status: delta === 0 ? 'EQUILIBRIUM' : (delta > 0 ? 'LEFT_HEAVY' : 'RIGHT_HEAVY') };
  }

  /**
   * Détecte si l'équation est résolue : x est isolé d'un côté (coefficient net 1,
   * sans constante) et l'autre côté ne contient que des constantes, le tout en équilibre.
   * Retourne { value } si résolu, sinon null.
   */
  checkSolved() {
    const sum = (list) => list.reduce((acc, item) => {
        if (item.type === 'X') acc.x += item.val; else acc.c += item.val;
        return acc;
    }, { x: 0, c: 0 });

    const L = sum(this.state.lhs);
    const R = sum(this.state.rhs);

    const leftIsolated  = this.state.lhs.length > 0 && L.x === 1 && L.c === 0 && R.x === 0;
    const rightIsolated = this.state.rhs.length > 0 && R.x === 1 && R.c === 0 && L.x === 0;

    if (!leftIsolated && !rightIsolated) return null;
    if (this.calculateTiltFactor().status !== 'EQUILIBRIUM') return null;

    return { value: leftIsolated ? R.c : L.c };
  }

  getEquationHTML() {
    const formatTerm = (item, index) => {
        const val = item.val;
        const type = item.type;
        const absVal = Math.abs(val);
        
        let sign = "";
        if (index > 0) {
            sign = val >= 0 ? " + " : " − ";
        } else {
            sign = val < 0 ? "− " : "";
        }

        let content = "";
        if (type === 'known') {
            content = `${absVal}`;
        } else {
            if (absVal === 1) content = `<i style="font-family:'Times New Roman', serif;">x</i>`;
            else content = `${absVal}<i style="font-family:'Times New Roman', serif;">x</i>`;
        }
        return `${sign}${content}`;
    };

    const buildSide = (list) => {
        // Agrégation par type : on additionne les x ensemble et les constantes
        // ensemble → affichage simplifié « 3x + 42 » (et non « x + x + x + 42 »).
        let xSum = 0, cSum = 0;
        list.forEach(it => { if (it.type === 'X') xSum += it.val; else cSum += it.val; });
        const terms = [];
        if (xSum !== 0) terms.push({ type: 'X', val: xSum });
        if (cSum !== 0) terms.push({ type: 'known', val: cSum });
        if (terms.length === 0) return "0";
        return terms.map((item, i) => formatTerm(item, i)).join("");
    };

    return `<span class="math-part">${buildSide(this.state.lhs)}</span> <span class="math-equal">=</span> <span class="math-part">${buildSide(this.state.rhs)}</span>`;
  }

  getEquationString() { return "Utiliser getEquationHTML()"; }
  updateConfig(newConfig) { this.config = { ...this.config, ...newConfig }; }
  randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
}