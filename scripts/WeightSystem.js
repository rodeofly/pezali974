import Matter from 'matter-js';
import { C } from './Constants.js';

export class WeightSystem {
    constructor() {
        this.bodyMap = new Map();
    }

    /**
     * USINE UNIQUE : Crée un poids (Positif ou Négatif)
     */
    create(type, x, y, value) {
        // 1. Gestion du Signe (Antimatière)
        const isNegative = value < 0;
        const absValue = Math.abs(value); // On utilise la valeur absolue pour la taille
        
        let body;
        
        // 2. DÉFINITION DES COULEURS (C'est ce bloc qui manquait !)
        let fill, stroke;
        if (type === 'X') {
            // Rouge si positif, Gris clair si négatif
            fill = isNegative ? C.COLORS.WEIGHT_NEG_UNKNOWN : C.COLORS.WEIGHT_UNKNOWN;
            stroke = '#c0392b';
        } else {
            // Bleu si positif, Blanc si négatif
            fill = isNegative ? C.COLORS.WEIGHT_NEG_KNOWN : C.COLORS.WEIGHT_KNOWN;
            stroke = '#2980b9';
        }

        // 3. Création du corps
        // Note: On ajoute un filtre de collision pour que les poids ne touchent pas le fléau fantôme
        const weightFilter = {
            category: C.CATEGORIES.WEIGHTS,
            // Touche : Murs, autres poids (libres ET verrouillés), plateaux.
            mask: C.CATEGORIES.DEFAULT | C.CATEGORIES.WEIGHTS | C.CATEGORIES.TRAYS | C.CATEGORIES.WEIGHTS_LOCKED
        };

        // Propriétés communes : objets lourds, sans rebond, qui ne tournent pas
        // (inertia: Infinity) → stables, lisibles, et ne « partent pas dans tous les sens ».
        const commonOptions = {
            restitution: C.WEIGHT.RESTITUTION,
            friction: C.WEIGHT.FRICTION,
            frictionAir: C.WEIGHT.FRICTION_AIR,
            density: C.WEIGHT.DENSITY,
            inertia: Infinity,
            render: { fillStyle: fill, strokeStyle: stroke, lineWidth: 2 },
            label: 'weight',
            collisionFilter: weightFilter
        };

        if (value === 0) {
            // Vestige d'annihilation : petite trace neutre à faire disparaître d'un tap.
            if (type === 'X') body = Matter.Bodies.rectangle(x, y, 38, 38, commonOptions);
            else body = Matter.Bodies.circle(x, y, 16, commonOptions);
        } else if (type === 'X') {
            const baseSize = 72;
            // Taille logarithmique pour éviter les géants
            const size = baseSize + Math.log(Math.max(1, absValue)) * 22;
            body = Matter.Bodies.rectangle(x, y, size, size, commonOptions);
        } else {
            const radius = 28 + Math.sqrt(Math.max(1, absValue)) * 5;
            body = Matter.Bodies.circle(x, y, radius, commonOptions);
        }

        // 4. Données Logiques
        body.logicData = { type, value }; // On garde la vraie valeur signée (-5)
        body.lastZone = null;

        this.bodyMap.set(body.id, body.logicData);

        return body;
    }

    createKnownWeight(x, y, value) { return this.create('known', x, y, value); }
    createUnknownWeight(x, y, value) { return this.create('X', x, y, value); }

    getData(bodyId) { return this.bodyMap.get(bodyId); }
}