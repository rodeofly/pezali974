import { C } from './Constants.js';
import Matter from 'matter-js';

const { Bodies, Body, Constraint } = Matter;

export const BalanceModels = {
    suspended: (x, y, width, height) => {
        const beamY = C.BALANCE.BEAM_Y;          
        const beamWidth = C.BALANCE.BEAM_WIDTH;      
        const chainLength = C.BALANCE.CHAIN_LENGTH;    
        const trayWidth = C.BALANCE.TRAY_WIDTH;      
        
        // --- PIED ---
        const standBase = Bodies.rectangle(x, height - 20, 200, 20, { 
            isStatic: true, isSensor: true, render: { fillStyle: C.COLORS.WOOD_DARK } 
        });
        const standPole = Bodies.rectangle(x, (height + beamY)/2, 20, height - beamY, { 
            isStatic: true, isSensor: true, render: { fillStyle: C.COLORS.WOOD_DARK } 
        });

        // --- FLÉAU ---
        const beam = Bodies.rectangle(x, beamY, beamWidth, 15, {
            plugin: { gravityScale: 0 }, 
            frictionAir: C.PHYSICS.FRICTION_AIR,
            mass: C.PHYSICS.BEAM_MASS,
            inertia: Infinity,
            render: { fillStyle: '#bfa378', strokeStyle: '#8e7cc3', lineWidth: 1 }
        });

        const pivot = Constraint.create({
            bodyA: beam, pointB: { x: x, y: beamY },
            stiffness: 1, length: 0,
            render: { visible: true, lineWidth: 6, strokeStyle: C.COLORS.GOLD_LIGHT }
        });

        // --- PLATEAUX ---
        const createJusticeTray = (sideFactor) => {
            const anchorX = (beamWidth / 2 - 5) * sideFactor;
            const startX = x + anchorX;
            const startY = beamY + chainLength;
            const wallH = C.BALANCE.TRAY_WALL_HEIGHT; 
            
            const base = Bodies.rectangle(startX, startY, trayWidth, 15, { 
                render: { fillStyle: C.COLORS.GOLD_LIGHT }, plugin: { gravityScale: 0 }
            });
            const wL = Bodies.rectangle(startX - trayWidth/2, startY - wallH/2, 4, wallH, { 
                render: { fillStyle: C.COLORS.GOLD_LIGHT }, plugin: { gravityScale: 0 }
            });
            const wR = Bodies.rectangle(startX + trayWidth/2, startY - wallH/2, 4, wallH, { 
                render: { fillStyle: C.COLORS.GOLD_LIGHT }, plugin: { gravityScale: 0 }
            });

            const tray = Body.create({
                parts: [base, wL, wR],
                friction: 1, restitution: 0,
                mass: C.PHYSICS.TRAY_MASS,
                inertia: Infinity,
                plugin: { gravityScale: 0 }
            });

            const chainOptions = {
                stiffness: 0.9, damping: 0.1, length: chainLength,
                render: { strokeStyle: C.COLORS.CHAIN, lineWidth: 1.5 }
            };
            const attachY = -wallH + 10; 

            const c1 = Constraint.create({
                bodyA: beam, bodyB: tray,
                pointA: { x: anchorX, y: 0 }, pointB: { x: -trayWidth/2, y: attachY }, 
                ...chainOptions
            });

            const c2 = Constraint.create({
                bodyA: beam, bodyB: tray,
                pointA: { x: anchorX, y: 0 }, pointB: { x: trayWidth/2, y: attachY },
                ...chainOptions
            });

            return { tray, constraints: [c1, c2] };
        };

        const leftSys = createJusticeTray(-1);
        const rightSys = createJusticeTray(1);

        const composites = [
            standBase, standPole,
            beam, pivot,
            leftSys.tray, ...leftSys.constraints,
            rightSys.tray, ...rightSys.constraints
        ];

        return { beam, leftTray: leftSys.tray, rightTray: rightSys.tray, composites };
    },

    roberval: () => null
};