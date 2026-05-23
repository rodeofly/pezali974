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

    // --- DIMENSIONS DES BACS (valeurs par défaut, écrasées par computeBalanceDims) ---
    BALANCE: {
        TRAY_WIDTH: 280,
        TRAY_WALL_HEIGHT: 130,    // référence visuelle pour le calcul de spawn
        BOUNDS_WALL_HEIGHT: 3000, // parois invisibles très hautes : la bounding
                                  // box englobe toute pile au-dessus du bac →
                                  // un poids empilé reste « dans » le plateau.
        TRAY_OFFSET: 320,
        MAX_TRAVEL: 90
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

/**
 * Calcule des dimensions de balance qui suivent la taille du viewport.
 * Mute C.BALANCE in place et retourne aussi les valeurs.
 */
export function computeBalanceDims(width, height) {
    // Facteur de réduction pour smartphones : 1 sur grand écran,
    // ~0.55 sur petit (vmin = côté le plus court du viewport).
    const vmin = Math.min(width, height);
    const sizeFactor = Math.max(0.55, Math.min(1, vmin / 700));

    const trayW = Math.max(140, Math.min(480, width * 0.32));
    const wallH = Math.max(70, Math.min(240, height * 0.22));
    const maxOffset = (width - trayW) / 2 - 30;
    // offset borné par maxOffset (sinon les plateaux sortent de l'écran).
    const offset = Math.min(maxOffset, Math.max(trayW * 0.5, width * 0.22));
    const maxTravel = Math.max(25, Math.min(140, height * 0.08));

    C.BALANCE.TRAY_WIDTH = trayW;
    C.BALANCE.TRAY_WALL_HEIGHT = wallH;
    C.BALANCE.TRAY_OFFSET = offset;
    C.BALANCE.MAX_TRAVEL = maxTravel;
    C.BALANCE.SIZE_FACTOR = sizeFactor;
    return C.BALANCE;
}