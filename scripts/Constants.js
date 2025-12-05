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
        WEIGHT_NEG_KNOWN: '#ecf0f1', // Blanc (Négatif)
        WEIGHT_NEG_UNKNOWN: '#bdc3c7', // Gris (-X)
        CHAIN: '#bdc3c7'
    },

    // --- CATÉGORIES DE COLLISION (Le secret du fléau fantôme) ---
    // Les puissances de 2 sont obligatoires pour les bitmasks
    CATEGORIES: {
        DEFAULT: 0x0001,
        BALANCE_MECA: 0x0002, // Le mécanisme (Fléau, Pied)
        WEIGHTS: 0x0004,      // Les poids
        TRAYS: 0x0008         // Les plateaux (qui doivent toucher les poids)
    },

    // --- DIMENSIONS ---
    BALANCE: {
        BEAM_WIDTH: 600,
        BEAM_Y: 140,
        CHAIN_LENGTH: 280,
        TRAY_WIDTH: 220,
        TRAY_WALL_HEIGHT: 100,
        TRAY_OFFSET: 280
    },

    // --- PHYSIQUE ---
    PHYSICS: {
        BEAM_MASS: 20, // Assez lourd pour être stable
        TRAY_MASS: 5,
        FRICTION_AIR: 0.5, // <--- TRÈS ÉLEVÉ : Calme les oscillations instantanément
        MAX_ANGLE: 0.5
    },

    // --- TIMING & SPAWN ---
    SPAWN: {
        DROP_HEIGHT: -150, // <--- HORS ÉCRAN (Au dessus)
        DELAY_BETWEEN_DROPS: 300,
        ZONE_CHECK_INTERVAL: 5 
    }
};