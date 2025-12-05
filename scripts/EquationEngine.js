export class EquationEngine {
  constructor() {
    this.state = {
      lhs: [], 
      rhs: [],
      xValue: 0
    };

    this.config = {
      minX: 1, maxX: 10,
      coeffRange: { min: 1, max: 5 }, // C'est cette config qui était ignorée
      constantRange: { min: 1, max: 20 }
    };
  }

  generateNewEquation() {
    const x = this.randomInt(this.config.minX, this.config.maxX);
    
    // --- CORRECTION DÉFINITIVE ---
    // On utilise les bornes de la config (pilotées par le nouveau slider)
    const minCoeff = this.config.coeffRange.min;
    const maxCoeff = this.config.coeffRange.max;

    // Choix de a
    let a = this.randomInt(minCoeff, maxCoeff);
    let c = a;

    // On s'assure que a != c (sauf si min == max, cas rare)
    if (minCoeff !== maxCoeff) {
        while (c === a) {
            c = this.randomInt(minCoeff, maxCoeff);
        }
    }
    // -----------------------------

    let b = this.randomInt(1, this.config.constantRange.max);
    let d = (a * x) + b - (c * x);

    if (d < 0) return this.generateNewEquation();

    this.state.xValue = x;
    this.resetCounts(); 

    return { a, b, c, d }; 
  }

  // ... (resetCounts, updateWeight, calculateTiltFactor, getEquationString, randomInt restent inchangés) ...
  resetCounts() {
    this.state.lhs = [];
    this.state.rhs = [];
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

  getEquationString() {
    const formatList = (list) => {
        if (list.length === 0) return "0";
        const sorted = [...list].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'X' ? -1 : 1; 
            return b.val - a.val; 
        });
        return sorted.map(item => {
            if (item.type === 'X') return item.val === 1 ? "X" : `${item.val}X`;
            return item.val;
        }).join(" + ");
    };
    return `${formatList(this.state.lhs)} = ${formatList(this.state.rhs)}`;
  }

  updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      console.log("Config mise à jour :", this.config);
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}