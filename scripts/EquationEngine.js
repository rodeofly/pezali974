/**
 * EquationEngine.js
 * Le cerveau mathématique de l'application.
 * Indépendant du rendu graphique pour une testabilité maximale.
 */

export class EquationEngine {
  constructor() {
    // État interne de l'équation 
    this.state = {
      lhs: { xCount: 0, constant: 0 }, // aX + b
      rhs: { xCount: 0, constant: 0 }, // cX + d
      xValue: 0, // La valeur cachée de X 
    };

    // Configuration par défaut 
    this.config = {
      minX: 1,
      maxX: 10,
      coeffRange: { min: 1, max: 5 },
      constantRange: { min: 1, max: 20 }
    };
  }

  /**
   * Génère une nouvelle équation cohérente.
   * Stratégie : On choisit X, puis on construit l'équation autour pour garantir une solution entière.
   * 
   */
  generateNewEquation() {
    // 1. Choix aléatoire de X 
    const x = this.randomInt(this.config.minX, this.config.maxX);
    
    // 2. Choix de a et c (coefficients de X) 
    // On s'assure que a != c pour éviter une équation sans solution unique ou infinie
    let a = this.randomInt(1, 4);
    let c = a;
    while (c === a) {
      c = this.randomInt(1, 4);
    }

    // 3. Choix de b (constante gauche)
    let b = this.randomInt(1, 10);

    // 4. Calcul de d pour que l'équation soit initialement équilibrée (optionnel)
    // OU on génère aléatoirement pour laisser l'utilisateur équilibrer.
    // Pour l'exercice type "Trouver X", on part souvent d'une balance équilibrée visuellement
    // mathématiquement: aX + b = cX + d  => d = aX + b - cX
    let d = (a * x) + b - (c * x);

    // Si d est négatif (impossible physiquement pour des poids simples), on recommence
    if (d < 0) {
      return this.generateNewEquation(); // Récursion simple (retry)
    }

    // Mise à jour de l'état
    this.state.xValue = x;
    this.state.lhs = { xCount: a, constant: b };
    this.state.rhs = { xCount: c, constant: d };

    return this.getEquationString();
  }

  /**
     * Réinitialise les compteurs (a, b, c, d) à 0
     * Mais garde la configuration (valeur de X, etc.)
     * Utilisé pour laisser la physique reconstruire l'équation.
     */
    resetCounts() {
        this.state.lhs = { xCount: 0, constant: 0 };
        this.state.rhs = { xCount: 0, constant: 0 };
    }

  /**
   * Ajoute ou retire un poids logiciellement.
   * Appelé quand le moteur physique détecte un drop dans une boîte.
   * 
   */
  updateWeight(side, type, value, operation = 'add') {
    const target = side === 'left' ? this.state.lhs : this.state.rhs;
    const sign = operation === 'add' ? 1 : -1;

    if (type === 'X') {
      target.xCount += (1 * sign); // Modifie 'a' ou 'c'
    } else {
      target.constant += (value * sign); // Modifie 'b' ou 'd'
    }

    // Empêcher les valeurs négatives (optionnel selon règles pédagogiques)
    if (target.xCount < 0) target.xCount = 0;
    if (target.constant < 0) target.constant = 0;
  }

  /**
   * Calcule le facteur de déséquilibre (Delta) pour le moteur physique.
   * C'est ici qu'on calcule le "Couple Artificiel".
   * 
   */
  calculateTiltFactor() {
    const { lhs, rhs, xValue } = this.state;

    // Calcul des masses totales virtuelles
    const leftMass = (lhs.xCount * xValue) + lhs.constant;
    const rightMass = (rhs.xCount * xValue) + rhs.constant;

    const delta = leftMass - rightMass; // 

    // Normalisation pour l'angle (éviter que la balance ne fasse des loopings)
    // On utilise une fonction sigmoïde ou clamp pour adoucir 
    const maxTilt = 0.5; // Angle max en radians (~28 degrés)
    const sensitivity = 0.05; // Sensibilité de la balance
    
    // Si delta est positif (gauche plus lourd), angle négatif (sens anti-horaire)
    // Matter.js : rotation horaire est positive. Donc gauche lourd = angle négatif.
    const targetAngle = Math.max(Math.min(delta * -sensitivity, maxTilt), -maxTilt);

    return {
      delta,
      leftMass,
      rightMass,
      targetAngle,
      status: delta === 0 ? 'EQUILIBRIUM' : (delta > 0 ? 'LEFT_HEAVY' : 'RIGHT_HEAVY')
    };
  }

  /**
   * Retourne l'équation formatée pour l'affichage UI
   * Ex: "3X + 5 = 2X + 10"
   * 
   */
  getEquationString() {
    const formatSide = (s) => {
      let parts = [];
      if (s.xCount > 0) parts.push(s.xCount === 1 ? "X" : `${s.xCount}X`);
      if (s.constant > 0 || parts.length === 0) parts.push(s.constant);
      return parts.join(" + ");
    };

    return `${formatSide(this.state.lhs)} = ${formatSide(this.state.rhs)}`;
  }

  // Utilitaire
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
