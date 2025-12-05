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
        WEIGHTS: 0x0004,
        TRAYS: 0x0008
    },

    // --- DIMENSIONS ---
    BALANCE: {
        BEAM_WIDTH: 700,
        BEAM_Y: 140,
        CHAIN_LENGTH: 280,
        TRAY_WIDTH: 300,
        TRAY_WALL_HEIGHT: 100,
        TRAY_OFFSET: 320
    },

    // --- PHYSIQUE ---
    PHYSICS: {
        BEAM_MASS: 20,
        TRAY_MASS: 5,
        FRICTION_AIR: 0.5,
        MAX_ANGLE: 0.5
    },

    // --- SPAWN ---
    SPAWN: {
        DROP_HEIGHT: -150,
        DELAY_BETWEEN_DROPS: 300,
        ZONE_CHECK_INTERVAL: 5 
    },

    // --- NOUVEAU : STYLE ---
    STYLE: {
        FONT: "bold 20px 'Times New Roman', serif" // Style LaTeX
    }
};