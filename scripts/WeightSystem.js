import Matter from 'matter-js';
import { C } from './Constants.js';

export class WeightSystem {
    constructor() {
        this.bodyMap = new Map();
    }

    /**
     * USINE UNIQUE : Crée un poids, configure ses données et le prépare.
     */
    create(type, x, y, value) {
        let body;
        
        if (type === 'X') {
            // X inconnu : la taille dépend du coefficient (value)
            const baseSize = 40;
            const size = baseSize + (value - 1) * 10; 
            
            body = Matter.Bodies.rectangle(x, y, size, size, {
                restitution: 0.1, friction: 0.9, density: 0.002,
                render: { fillStyle: C.COLORS.WEIGHT_UNKNOWN, strokeStyle: '#c0392b', lineWidth: 2 },
                label: 'weight'
            });
        } else {
            // Poids connu : le rayon dépend de la valeur
            const radius = 15 + (value * 1.5);
            
            body = Matter.Bodies.circle(x, y, radius, {
                restitution: 0.1, friction: 0.8, density: 0.002,
                render: { fillStyle: C.COLORS.WEIGHT_KNOWN, strokeStyle: '#2980b9', lineWidth: 2 },
                label: 'weight'
            });
        }

        // Configuration Standardisée (DRY)
        body.logicData = { type, value };
        body.lastZone = null;

        // On l'ajoute à notre map interne si besoin (optionnel avec la nouvelle logique)
        this.bodyMap.set(body.id, body.logicData);

        return body;
    }

    // Garde les anciennes méthodes pour compatibilité si besoin, 
    // mais idéalement on utilise 'create' partout.
    createKnownWeight(x, y, value) { return this.create('known', x, y, value); }
    createUnknownWeight(x, y, value) { return this.create('X', x, y, value); }

    getData(bodyId) { return this.bodyMap.get(bodyId); }
}