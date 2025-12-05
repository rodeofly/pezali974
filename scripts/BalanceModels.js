import Matter from 'matter-js';

const { Bodies, Body, Constraint } = Matter;

export const BalanceModels = {
    suspended: (x, y, width, height) => {
        // --- CONFIG ---
        const beamY = 140;          
        const beamWidth = 600;      
        const chainLength = 280;    
        const trayWidth = 220;      
        
        // --- 1. LE PIED ---
        const standBase = Bodies.rectangle(x, height - 20, 200, 20, { 
            isStatic: true, isSensor: true, render: { fillStyle: '#4a3b32' } 
        });
        const standPole = Bodies.rectangle(x, (height + beamY)/2, 20, height - beamY, { 
            isStatic: true, isSensor: true, render: { fillStyle: '#4a3b32' } 
        });

        // --- 2. LE FLÉAU PILOTÉ ---
        const beam = Bodies.rectangle(x, beamY, beamWidth, 15, {
            plugin: { gravityScale: 0 }, 
            frictionAir: 0.1,
            
            // --- SECRET DE LA STABILITÉ ---
            mass: 10,           // Lourd mais pas trop
            inertia: Infinity,  // <--- CRUCIAL : Empêche toute rotation physique non désirée
            
            render: { fillStyle: '#bfa378', strokeStyle: '#8e7cc3', lineWidth: 1 }
        });

        // Pivot central (Simple clou)
        const pivot = Constraint.create({
            bodyA: beam, pointB: { x: x, y: beamY },
            stiffness: 1, length: 0,
            render: { visible: true, lineWidth: 6, strokeStyle: '#d4af37' }
        });

        // --- 3. LES PLATEAUX ---
        const createJusticeTray = (sideFactor) => {
            const anchorX = (beamWidth / 2 - 5) * sideFactor;
            const startX = x + anchorX;
            const startY = beamY + chainLength;
            const wallH = 100; 
            
            const base = Bodies.rectangle(startX, startY, trayWidth, 15, { 
                render: { fillStyle: '#d4af37' }, plugin: { gravityScale: 0 }
            });
            const wL = Bodies.rectangle(startX - trayWidth/2, startY - wallH/2, 4, wallH, { 
                render: { fillStyle: '#d4af37' }, plugin: { gravityScale: 0 }
            });
            const wR = Bodies.rectangle(startX + trayWidth/2, startY - wallH/2, 4, wallH, { 
                render: { fillStyle: '#d4af37' }, plugin: { gravityScale: 0 }
            });

            const tray = Body.create({
                parts: [base, wL, wR],
                friction: 1, restitution: 0,
                mass: 3,            // <--- Masse raisonnable pour amortir les chocs
                inertia: Infinity,  // Ne tourne pas
                plugin: { gravityScale: 0 }
            });

            // Chaînes
            const chainOptions = {
                stiffness: 0.9,  // Assez rigide
                damping: 0.1,    // Amortissement
                length: chainLength,
                render: { strokeStyle: '#bdc3c7', lineWidth: 1.5 }
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