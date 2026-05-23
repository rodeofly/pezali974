# ⚖️ Pezali974 — Balance & Équations

> **Une balance physique pour résoudre des équations linéaires avec les doigts (ou la souris).**
> Pose les poids, garde l'équilibre, isole l'inconnue. Mathématiques niveau collège, geste de cycle 2.

<p align="center">
  <a href="https://rodeofly.github.io/pezali974/">
    <img alt="Jouer maintenant" src="https://img.shields.io/badge/🎮%20DÉMO%20EN%20LIGNE-jouer%20maintenant-2ea44f?style=for-the-badge">
  </a>
</p>

<p align="center">
  <a href="https://rodeofly.github.io/pezali974/">https://rodeofly.github.io/pezali974/</a>
</p>

---

## 📖 L'idée

Une équation comme `2𝑥 + 5 = 𝑥 + 11`, ce sont deux côtés qui pèsent pareil. Si tu enlèves le même poids des deux côtés, l'égalité tient ; si tu divises par le même nombre, l'égalité tient aussi. C'est exactement ce que fait cette appli : tu manipules des poids sur une vraie balance, et tu observes l'effet sur l'équation en haut de l'écran.

- Les **carrés rouges** sont l'inconnue 𝑥. Leur masse est secrète.
- Les **cercles bleus** sont les constantes (la valeur est écrite dessus).
- Les versions **claires** sont les opposés (négatifs).
- L'entête affiche `=` quand la balance est en équilibre, `≠` sinon — y compris pendant un drag asymétrique.
- Quand l'inconnue est isolée et l'équilibre atteint, l'ensemble solution `S = { … }` s'inscrit dans le journal.

## 🎮 Comment ça se joue

La barre des pouvoirs à droite contient quatre opérations. Chacune ouvre un panneau collé au bas de l'écran.

| Bouton | Action |
|---|---|
| **+** Ajouter | Ouvre la banque ; clique une puce pour faire tomber ce poids **des deux côtés**. |
| **−** Retirer | Fait apparaître la corbeille ; glisse-y un poids — son jumeau de l'autre côté part avec lui. |
| **×** Multiplier | À venir. |
| **÷** Diviser | Slider, champ libre, ou `−1` pour prendre l'opposé. Chaque poids se découpe en parts (`?` = non divisible). Clique **Valider**. |

Et trois mécaniques passives :

- **Fusion** : glisse un poids sur un autre du même type → ils s'additionnent (3 + 5 = 8).
- **Annihilation** : un poids sur son opposé → vaporisation. Le « 0 » qui reste se vaporise d'un tap.
- **Double-clic / double-tap** sur un poids → il se découpe en deux (la valeur d'en face en priorité).

Le panneau **⚙️ Configuration** propose deux presets :
- **Cycle 3** : tout positif, solution garantie positive.
- **Cycle 4** : `[−20, +20]` partout, équations à coefficients négatifs autorisées.

Tu peux aussi régler chaque paramètre individuellement avec les dual-sliders (`xmin/xmax`, `coefmin/coefmax`, `cmin/cmax`).

## 🏗️ Sous le capot

- **[Matter.js](https://brm.io/matter-js/)** pour la physique 2D — fléau articulé, plateaux contraints à l'horizontale via un placement arc-tangentiel, sol fin collé en bas d'écran.
- **JS modulaire** (ES6) : `EquationEngine` (logique de résolution), `PhysicsWorld` (scène + rendu), `WeightSystem` (création des poids), `InteractionManager` (drag, fusion, division, double-clic), `UIManager` (panneaux et historique).
- **CSS responsive en `clamp()` + `vmin`** — les dimensions des plateaux, la longueur du mât (25 % de la hauteur viewport), la taille des poids et la police des labels s'adaptent du smartphone paysage au grand écran.
- **Vite** pour le dev / build.
- **GitHub Actions** déploie automatiquement sur GitHub Pages à chaque push sur `main`.

## 💻 Lancer en local

```bash
git clone https://github.com/rodeofly/pezali974.git
cd pezali974
npm install
npm run dev          # serveur de dev sur http://localhost:5173/pezali974/
npm run build        # bundle de production dans dist/
```

## 📁 Structure

```
pezali974/
├── index.html
├── style.css
├── public/                  # assets statiques (logo, image de fond)
├── scripts/
│   ├── main.js              # orchestration
│   ├── EquationEngine.js    # parser, générateur, résolution
│   ├── PhysicsWorld.js      # scène Matter.js, fléau, rendu canvas
│   ├── BalanceModels.js     # géométrie des plateaux (compound bodies)
│   ├── WeightSystem.js      # usine de poids (carrés/cercles)
│   ├── InteractionManager.js # drag, fusion, annihilation, division
│   ├── UIManager.js         # header, panneaux, journal de résolution
│   └── Constants.js         # tokens dimensionnels + computeBalanceDims
└── .github/workflows/deploy.yml  # CI → GitHub Pages
```

## 🤝 Contribuer

Issues et pull requests bienvenues. Pour des changements majeurs, ouvre d'abord une issue pour qu'on en discute.

---

<p align="center">Développé avec ❤️ par <a href="https://www.maths974.fr">Maths974.fr</a> · La Réunion 🌋</p>
