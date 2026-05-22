export const C = {
    // --- COULEURS ---
    COLORS: {
        BACKGROUND: '#1e1e24',
        GOLD_DARK: '#b7950b',
        GOLD_LIGHT: '#d4af37',
        WOOD_DARK: '#4a3b32',
        METAL_GREY: '#95a5a6',
        WEIGHT_KNOWN: '#3498db',   // Bleu
        WEIGHT_UNKNOWN: '#e74c3c', // Rouge
        WEIGHT_NEG_KNOWN: '#ecf0f1', // Blanc
        WEIGHT_NEG_UNKNOWN: '#bdc3c7', // Gris
        CHAIN: '#bdc3c7'
    },

    CATEGORIES: {
        DEFAULT: 0x0001,
        BALANCE_MECA: 0x0002,
        WEIGHTS: 0x0004,        // poids libre (attrapable à la souris)
        TRAYS: 0x0008,
        WEIGHTS_LOCKED: 0x0010  // poids posé dans un bac : il pèse, mais n'est plus attrapable
    },

    // --- DIMENSIONS DES BACS ---
    BALANCE: {
        TRAY_WIDTH: 280,        // largeur d'un bac
        TRAY_WALL_HEIGHT: 130,  // hauteur des parois
        TRAY_OFFSET: 320,       // distance horizontale depuis le centre
        MAX_TRAVEL: 90          // déplacement vertical max d'un bac (position de repos calculée au centre de l'écran)
    },

    // --- MOUVEMENT DES BACS ---
    PHYSICS: {
        SENSITIVITY: 5,    // pixels de déplacement par unité de déséquilibre (avant plafonnement)
        EASING: 0.08,      // lissage du mouvement vertical (0 = figé, 1 = instantané)
        SETTLE_SPEED: 2.0  // un poids ne « pèse » qu'une fois posé : vitesse sous ce seuil
    },

    // --- PROPRIÉTÉS DES POIDS (objets massifs et stables) ---
    WEIGHT: {
        RESTITUTION: 0,     // aucun rebond
        FRICTION: 1,        // forte adhérence
        FRICTION_AIR: 0.05, // amortissement de l'air (calme les déplacements)
        DENSITY: 0.02       // objets « lourds » : difficiles à projeter
    },

    // --- SPAWN ---
    SPAWN: {
        DROP_HEIGHT: 110,         // hauteur d'apparition en mode pluie (juste au-dessus des bacs)
        DELAY_BETWEEN_DROPS: 250,
        ZONE_CHECK_INTERVAL: 5
    },

    // --- NOUVEAU : STYLE ---
    STYLE: {
        FONT: "bold 20px 'Times New Roman', serif" // Style LaTeX
    }
};