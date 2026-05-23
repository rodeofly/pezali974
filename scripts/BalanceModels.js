import { C } from './Constants.js';
import Matter from 'matter-js';

const { Bodies, Body } = Matter;

export const BalanceModels = {
    /**
     * Modèle épuré : deux bacs en U (sans fléau, ni chaînes, ni potence).
     * Les bacs sont statiques ; leur position verticale est pilotée par
     * PhysicsWorld.syncTrayPositions() en fonction du déséquilibre.
     */
    simple: (centerX, baseY) => {
        const trayY = baseY;
        const trayW = C.BALANCE.TRAY_WIDTH;
        const wallH = C.BALANCE.TRAY_WALL_HEIGHT;
        const offset = C.BALANCE.TRAY_OFFSET;

        const trayFilter = {
            category: C.CATEGORIES.TRAYS,
            mask: C.CATEGORIES.DEFAULT | C.CATEGORIES.WEIGHTS | C.CATEGORIES.WEIGHTS_LOCKED
        };

        const buildTray = (cx) => {
            // Base visible (or), parois INVISIBLES mais bien présentes (barrières
            // qui empêchent les poids de tomber sur les côtés).
            const baseStyle = {
                render: { fillStyle: C.COLORS.GOLD_LIGHT, strokeStyle: C.COLORS.GOLD_DARK, lineWidth: 2 },
                collisionFilter: trayFilter
            };
            const wallStyle = {
                render: { visible: false },
                collisionFilter: trayFilter
            };
            const base = Bodies.rectangle(cx, trayY, trayW, 18, { ...baseStyle, chamfer: { radius: 8 } });
            const wallL = Bodies.rectangle(cx - trayW / 2, trayY - wallH / 2, 24, wallH, wallStyle);
            const wallR = Bodies.rectangle(cx + trayW / 2, trayY - wallH / 2, 24, wallH, wallStyle);

            return Body.create({
                parts: [base, wallL, wallR],
                isStatic: true,
                friction: 1,
                label: 'tray'
            });
        };

        const leftTray = buildTray(centerX - offset);
        const rightTray = buildTray(centerX + offset);

        return { leftTray, rightTray, composites: [leftTray, rightTray] };
    }
};
