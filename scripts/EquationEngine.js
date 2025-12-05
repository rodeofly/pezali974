export class EquationEngine {
  constructor() {
    // NOUVEL ÉTAT : Des listes d'objets (Inventaire)
    // lhs = Left Hand Side (Gauche), rhs = Right Hand Side (Droite)
    this.state = {
      lhs: [], // ex: [{type: 'X', val: 2}, {type: 'known', val: 5}]
      rhs: [],
      xValue: 0
    };

    this.config = {
      minX: 1, maxX: 10,
      coeffRange: { min: 1, max: 5 },
      constantRange: { min: 1, max: 20 }
    };
  }

  generateNewEquation() {
    const x = this.randomInt(this.config.minX, this.config.maxX);
    
    // On génère des coefficients aléatoires
    let a = this.randomInt(1, 4);
    let c = a;
    while (c === a) c = this.randomInt(1, 4);

    let b = this.randomInt(1, 10);
    let d = (a * x) + b - (c * x);

    // Si l'équation est impossible (d < 0), on recommence
    if (d < 0) return this.generateNewEquation();

    this.state.xValue = x;
    this.resetCounts(); 

    // On retourne la recette pour que le main.js sache quoi faire tomber
    return { a, b, c, d }; 
  }

  resetCounts() {
    this.state.lhs = [];
    this.state.rhs = [];
  }

  /**
   * Ajoute ou retire un objet spécifique de l'inventaire
   */
  updateWeight(side, type, value, operation = 'add') {
    const list = side === 'left' ? this.state.lhs : this.state.rhs;

    if (operation === 'add') {
        // On ajoute l'objet à la liste
        list.push({ type, val: value });
    } else {
        // On cherche un objet identique pour le retirer (le premier trouvé)
        const index = list.findIndex(item => item.type === type && item.val === value);
        if (index !== -1) {
            list.splice(index, 1);
        }
    }
  }

  /**
   * Calcule si la balance penche (Somme des masses réelles)
   */
  calculateTiltFactor() {
    // Fonction helper pour calculer le poids total d'un côté
    const sumSide = (list) => list.reduce((acc, item) => {
        // Si c'est X, on multiplie par la valeur cachée de X. Sinon c'est juste la valeur.
        const mass = item.type === 'X' ? (item.val * this.state.xValue) : item.val;
        return acc + mass;
    }, 0);

    const leftMass = sumSide(this.state.lhs);
    const rightMass = sumSide(this.state.rhs);
    const delta = leftMass - rightMass;

    const maxTilt = 0.6; 
    const sensitivity = 0.05;
    const targetAngle = Math.max(Math.min(delta * -sensitivity, maxTilt), -maxTilt);

    return { 
        delta, 
        targetAngle, 
        status: delta === 0 ? 'EQUILIBRIUM' : (delta > 0 ? 'LEFT_HEAVY' : 'RIGHT_HEAVY') 
    };
  }

  /**
   * Génère le texte de l'équation (ex: "2X + X + 5")
   */
  getEquationString() {
    const formatList = (list) => {
        if (list.length === 0) return "0";
        
        // On trie pour faire joli : les X d'abord, puis les nombres
        // Et on regroupe les gros d'abord (2X avant X)
        const sorted = [...list].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'X' ? -1 : 1; // X avant Nombre
            return b.val - a.val; // Plus grand d'abord
        });

        // On transforme la liste en texte
        return sorted.map(item => {
            if (item.type === 'X') return item.val === 1 ? "X" : `${item.val}X`;
            return item.val;
        }).join(" + ");
    };

    return `${formatList(this.state.lhs)} = ${formatList(this.state.rhs)}`;
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}