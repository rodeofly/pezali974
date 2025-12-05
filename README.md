# ⚖️ EquaMotion974 (Pezali974)

> **Un simulateur de balance interactif pour apprendre à résoudre des équations linéaires par la physique.**

[![Demo Live](https://img.shields.io/badge/DEMO-JOUER%20MAINTENANT-2ea44f?style=for-the-badge&logo=github)](https://rodeofly.github.io/pezali974/)

🔗 **Lien direct vers la démo :** [https://rodeofly.github.io/pezali974/](https://rodeofly.github.io/pezali974/)

---

## 📖 À propos

**EquaMotion974** est un outil pédagogique conçu pour visualiser les concepts abstraits de l'algèbre. En utilisant un moteur physique 2D (Matter.js), il transforme les équations mathématiques (ex: `2x + 3 = 11`) en une balance physique réelle.

L'objectif est d'isoler l'inconnue **$x$** (les carrés) en manipulant les poids sur les plateaux, tout en maintenant l'équilibre, exactement comme on le ferait mathématiquement.

## ✨ Fonctionnalités Clés

### 🎮 Deux Modes de Jeu
L'application propose deux approches distinctes via le switch "Mode Rapide" :

1.  **Mode Physique ("Pluie") 🌧️**
    * Les objets tombent du ciel.
    * Interactions physiques réalistes (collisions, gravité).
    * **Antimatière :** Pour soustraire une valeur, on fait tomber un poids négatif (gris/blanc). Lorsqu'il touche un poids positif, les deux s'annihilent (disparaissent) !

2.  **Mode Rapide ("Solver") ⚡**
    * Modification instantanée des objets sur les plateaux.
    * Idéal pour tester rapidement des hypothèses de résolution.
    * Gestion intelligente : transforme, divise ou supprime les objets instantanément sans attendre la chute.

### 🧪 Mécaniques
* **Les Inconnues ($x$)** : Représentées par des carrés (Rouge/Gris). Leur masse est secrète et définie aléatoirement.
* **Les Constantes ($1$)** : Représentées par des cercles (Bleu/Blanc).
* **Division Intuitivre** : Double-cliquez sur un poids pour le diviser en plusieurs morceaux (ex: diviser un bloc de 10 en deux blocs de 5).
* **Générateur d'Équations** : Crée automatiquement des problèmes solubles de type $ax + b = cx + d$.

## 🛠️ Interface & Contrôles

* **Drag & Drop** : Déplacez les poids manuellement avec la souris.
* **Barre de Résolution (Bas)** : Utilisez les boutons `+x`, `-x`, `+1`, `-1` pour appliquer la même opération des deux côtés de la balance (principe d'égalité).
* **Menu Latéral** : Ajoutez des poids librement pour expérimenter.
* **Panneau de Configuration (⚙️)** : Ajustez la difficulté, la valeur maximale de $x$ et le mode de division.

## 💻 Installation Locale

Si vous souhaitez cloner le projet et le modifier sur votre machine :

1.  **Cloner le dépôt :**
    ```bash
    git clone [https://github.com/rodeofly/pezali974.git](https://github.com/rodeofly/pezali974.git)
    cd pezali974
    ```

2.  **Installer les dépendances :**
    ```bash
    npm install
    ```

3.  **Lancer le serveur de développement :**
    ```bash
    npm run dev
    ```

4.  **Construire pour la production :**
    ```bash
    npm run build
    ```

## 🏗️ Technologies Utilisées

* **[Matter.js](https://brm.io/matter-js/)** : Moteur physique 2D pour la simulation de la balance et des collisions.
* **JavaScript (ES6 Modules)** : Architecture orientée objet (`PhysicsWorld`, `EquationEngine`, `InteractionManager`).
* **Vite** : Outil de build ultra-rapide.

## 🤝 Contribuer

Les suggestions et les pull requests sont les bienvenues ! Pour des changements majeurs, veuillez d'abord ouvrir une issue pour discuter de ce que vous aimeriez changer.

---

*Développé avec ❤️ par [Maths974.fr](https://www.maths974.fr).à La Réunion (974).*