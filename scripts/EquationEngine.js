export class EquationEngine {
  constructor() {
    this.state = { lhs: [], rhs: [], xValue: 0 };
    this.config = {
      fixedX: false,
      targetX: 10, 
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
          // Cas normal : Solution unique
          // On arrondit pour rester dans le monde des entiers du jeu, 
          // mais mathématiquement on devrait garder les flottants.
          this.state.xValue = Math.round(deltaConst / deltaCoeff);
          console.log(`[EquationEngine] Solution calculée : x = ${this.state.xValue}`);
      } else {
          // Cas parallèle (a = c)
          if (deltaConst === 0) {
              // 2x + 5 = 2x + 5 (Toujours vrai). X peut être n'importe quoi.
              this.state.xValue = 10; 
              console.log(`[EquationEngine] Identité : x arbitraire mis à 10`);
          } else {
              // 2x + 5 = 2x + 10 (Impossible). 
              // OPTION B : On fixe une valeur arbitraire, la balance penchera.
              this.state.xValue = 10;
              console.log(`[EquationEngine] Impossible : La balance penchera.`);
          }
      }
  }

  // --- GÉNÉRATION AUTOMATIQUE ---
  generateNewEquation() {
    let x;
    if (this.config.fixedX) {
        x = this.config.targetX;
    } else {
        x = this.randomInt(-this.config.targetX, this.config.targetX);
        while (x === 0) x = this.randomInt(-this.config.targetX, this.config.targetX);
    }

    const minCoeff = this.config.coeffRange.min;
    const maxCoeff = this.config.coeffRange.max;

    let a = this.randomInt(minCoeff, maxCoeff);
    let c = a;
    if (minCoeff !== maxCoeff) {
        while (c === a) c = this.randomInt(minCoeff, maxCoeff);
    }

    let b = this.randomInt(1, this.config.constantRange.max);
    let d = (a * x) + b - (c * x);

    this.state.xValue = x;
    this.resetCounts(); 

    if (a !== 0) this.updateWeight('left', 'X', a);
    if (b !== 0) this.updateWeight('left', 'known', b);
    if (c !== 0) this.updateWeight('right', 'X', c);
    if (d !== 0) this.updateWeight('right', 'known', d);

    return { a, b, c, d }; 
  }

  resetCounts() { this.state.lhs = []; this.state.rhs = []; }

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
        if (list.length === 0) return "0";
        const sorted = [...list].sort((a, b) => (a.type === 'X' ? -1 : 1));
        return sorted.map((item, i) => formatTerm(item, i)).join("");
    };

    return `<span class="math-part">${buildSide(this.state.lhs)}</span> <span class="math-equal">=</span> <span class="math-part">${buildSide(this.state.rhs)}</span>`;
  }

  getEquationString() { return "Utiliser getEquationHTML()"; }
  updateConfig(newConfig) { this.config = { ...this.config, ...newConfig }; }
  randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
}