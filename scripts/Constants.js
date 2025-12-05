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
        CHAIN: '#bdc3c7'
    },

    // --- DIMENSIONS BALANCE (Modèle Justice) ---
    BALANCE: {
        BEAM_WIDTH: 600,
        BEAM_Y: 140,
        CHAIN_LENGTH: 280,
        TRAY_WIDTH: 220,
        TRAY_WALL_HEIGHT: 100,
        TRAY_OFFSET: 280 // Écartement pour le spawn
    },

    // --- PHYSIQUE ---
    PHYSICS: {
        BEAM_MASS: 10,
        TRAY_MASS: 3,
        FRICTION_AIR: 0.1,
        MAX_ANGLE: 0.6 // ~35 degrés
    },

    // --- TIMING & SPAWN ---
    SPAWN: {
        DROP_HEIGHT: 350, // Y position de spawn
        DELAY_BETWEEN_DROPS: 200, // ms
        ZONE_CHECK_INTERVAL: 10 // Vérifier les zones toutes les X frames (Optimisation)
    }
};