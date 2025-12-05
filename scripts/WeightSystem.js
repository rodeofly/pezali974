import Matter from 'matter-js';
import { C } from './Constants.js';

export class WeightSystem {
    constructor() {
        this.bodyMap = new Map();
    }

    /**
     * USINE UNIQUE : Crée un poids avec une taille maîtrisée.
     */
    create(type, x, y, value) {
        let body;
        
        if (type === 'X') {
            // --- CORRECTION TAILLE X ---
            // Avant : baseSize + (value - 1) * 10 (Linéaire -> Explosion)
            // Après : Croissance douce (Logarithmique)
            // 1X -> 40px
            // 10X -> 65px (et pas 140px)
            // 20X -> 75px (et pas 240px)
            const baseSize = 40;
            const size = baseSize + Math.log(value) * 12; 
            
            body = Matter.Bodies.rectangle(x, y, size, size, {
                restitution: 0.1, friction: 0.9, density: 0.002,
                render: { fillStyle: C.COLORS.WEIGHT_UNKNOWN, strokeStyle: '#c0392b', lineWidth: 2 },
                label: 'weight'
            });
        } else {
            // --- CORRECTION TAILLE NOMBRES ---
            // Avant : 15 + value * 1.5 (Pour 124 -> Rayon 200px -> Diamètre 400px !)
            // Après : Racine carrée ou Logarithme
            // 1 -> Rayon 18px
            // 100 -> Rayon 45px
            // 150 -> Rayon 50px
            const radius = 15 + Math.sqrt(value) * 3;
            
            body = Matter.Bodies.circle(x, y, radius, {
                restitution: 0.1, friction: 0.8, density: 0.002,
                render: { fillStyle: C.COLORS.WEIGHT_KNOWN, strokeStyle: '#2980b9', lineWidth: 2 },
                label: 'weight'
            });
        }

        body.logicData = { type, value };
        body.lastZone = null;

        this.bodyMap.set(body.id, body.logicData);

        return body;
    }

    createKnownWeight(x, y, value) { return this.create('known', x, y, value); }
    createUnknownWeight(x, y, value) { return this.create('X', x, y, value); }

    getData(bodyId) { return this.bodyMap.get(bodyId); }
}