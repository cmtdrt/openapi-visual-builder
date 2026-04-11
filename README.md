## openapi-visual-builder

Éditeur visuel **OpenAPI** (MVP) avec **Blockly** et **TypeScript** : blocs emboîtables, export YAML/JSON, sauvegarde du workspace en XML.

### Démarrer

```bash
npm install
npm run dev
```

### Code

- `src/openapi/blocks.ts` — définition des blocs OpenAPI
- `src/openapi/buildFromBlocks.ts` — workspace → objet OpenAPI
- `src/openapi/ui.ts` — injection Blockly + panneaux
