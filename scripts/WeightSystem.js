import Matter from 'matter-js';

export class WeightSystem {
    constructor() {
        // Dictionnaire pour mapper body.id -> { type: 'known'|'X', value: number }
        this.bodyMap = new Map();
    }

    /**
     * Crée un poids numérique (ex: 1, 2, 5)
     * Forme : Cercle (roule bien)
     * [cite: 61]
     */
    createKnownWeight(x, y, value) {
        const radius = 15 + (value * 2); // Taille proportionnelle
        const body = Matter.Bodies.circle(x, y, radius, {
            restitution: 0.1, // Rebondit un peu
            friction: 0.8,
            density: 0.002, // Assez lourd
            render: {
                fillStyle: '#3498db', // Bleu
                strokeStyle: '#2980b9',
                lineWidth: 2
            },
            label: 'weight' // Tag pour la détection
        });

        // On stocke les infos logiques associées à ce corps physique
        this.bodyMap.set(body.id, { type: 'known', value: value });
        return body;
    }

    /**
     * Crée le poids inconnu X
     * Forme : Carré/Boîte (distinct du reste)
     * 
     */
    createUnknownWeight(x, y) {
        const size = 40;
        const body = Matter.Bodies.rectangle(x, y, size, size, {
            restitution: 0.1,
            friction: 0.9,
            density: 0.002,
            render: {
                fillStyle: '#e74c3c', // Rouge distinctif
                strokeStyle: '#c0392b',
                lineWidth: 2
            },
            label: 'weight'
        });

        // La valeur est null ici, car c'est le LogicEngine qui connaît la vraie valeur de X
        this.bodyMap.set(body.id, { type: 'X', value: null });
        return body;
    }

    /**
     * Récupère les données logiques d'un corps physique
     */
    getData(bodyId) {
        return this.bodyMap.get(bodyId);
    }
}