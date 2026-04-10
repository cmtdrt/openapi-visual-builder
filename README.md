## Blockly (TypeScript) — projet de découverte

Petit playground **Vite + TypeScript** pour tester **Blockly** :
- un workspace Blockly avec toolbox (logique/boucles/math/texte/variables/fonctions)
- export/import **XML**
- génération de **code JavaScript**

### Démarrer

```bash
npm install
npm run dev
```

Puis ouvre l’URL affichée par Vite.

### Où regarder dans le code

- `src/playground/blocklyDemo.ts` : injection du workspace, toolbox, export/import, génération de code
- `src/main.ts` : point d’entrée
- `src/style.css` : layout simple

