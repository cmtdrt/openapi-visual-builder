import * as Blockly from 'blockly'

export function registerOpenApiMvpBlocks() {
  if (Blockly.Blocks['openapi_root']) return

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'openapi_root',
      message0: 'OpenAPI %1 titre %2 version %3 %4 schémas réutilisables %5 paths %6',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OPENAPI_VERSION',
          options: [
            ['3.0.3', '3.0.3'],
            ['3.1.0', '3.1.0'],
          ],
        },
        { type: 'field_input', name: 'TITLE', text: 'Mon API' },
        { type: 'field_input', name: 'API_VERSION', text: '1.0.0' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'SCHEMA_DEFS', check: 'SCHEMA_DEF' },
        { type: 'input_statement', name: 'PATHS', check: 'PATH' },
      ],
      colour: 285,
      tooltip: 'Point d’entrée du contrat OpenAPI (MVP).',
      helpUrl: '',
      hat: 'cap',
    },
    {
      type: 'openapi_path',
      message0: 'path %1 %2 methods %3',
      args0: [
        { type: 'field_input', name: 'PATH', text: '/hello' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'METHODS', check: 'METHOD' },
      ],
      previousStatement: 'PATH',
      nextStatement: 'PATH',
      colour: 210,
      tooltip: 'Un PathItem OpenAPI (ex: /users/{id}).',
      helpUrl: '',
    },
    {
      type: 'openapi_method',
      message0: 'méthode %1 résumé %2 %3 responses %4',
      args0: [
        {
          type: 'field_dropdown',
          name: 'VERB',
          options: [
            ['GET', 'get'],
            ['POST', 'post'],
            ['PUT', 'put'],
            ['PATCH', 'patch'],
            ['DELETE', 'delete'],
          ],
        },
        { type: 'field_input', name: 'SUMMARY', text: 'Décrit ce que fait l’endpoint' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'RESPONSES', check: 'RESPONSE' },
      ],
      previousStatement: 'METHOD',
      nextStatement: 'METHOD',
      colour: 160,
      tooltip: 'Une Operation (verbe HTTP) pour un path.',
      helpUrl: '',
    },
    {
      type: 'openapi_response',
      message0: 'response %1 description %2 %3 schema %4',
      args0: [
        { type: 'field_input', name: 'STATUS', text: '200' },
        { type: 'field_input', name: 'DESCRIPTION', text: 'OK' },
        { type: 'input_dummy' },
        { type: 'input_value', name: 'SCHEMA', check: 'SCHEMA' },
      ],
      previousStatement: 'RESPONSE',
      nextStatement: 'RESPONSE',
      colour: 65,
      tooltip: 'Une réponse HTTP (code + description + schema optionnel).',
      helpUrl: '',
    },
    {
      type: 'openapi_schema_primitive',
      message0: 'schema (primitive) type %1 format %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'TYPE',
          options: [
            ['string', 'string'],
            ['number', 'number'],
            ['integer', 'integer'],
            ['boolean', 'boolean'],
          ],
        },
        { type: 'field_input', name: 'FORMAT', text: '' },
      ],
      output: 'SCHEMA',
      colour: 20,
      tooltip: 'Schema JSON simple (type + format optionnel).',
      helpUrl: '',
    },
    {
      type: 'openapi_schema_ref',
      message0: '$ref vers schema %1',
      args0: [{ type: 'field_input', name: 'REF_NAME', text: 'MonModele' }],
      output: 'SCHEMA',
      colour: 290,
      tooltip: 'Référence OpenAPI : #/components/schemas/<nom>',
      helpUrl: '',
    },
    {
      type: 'openapi_schema_def',
      message0: 'schema nom %1 définition %2',
      args0: [
        { type: 'field_input', name: 'SCHEMA_NAME', text: 'MonModele' },
        { type: 'input_value', name: 'SCHEMA', check: 'SCHEMA' },
      ],
      previousStatement: 'SCHEMA_DEF',
      nextStatement: 'SCHEMA_DEF',
      colour: 45,
      tooltip: 'Déclare un schéma réutilisable sous components.schemas.',
      helpUrl: '',
    },
  ])
}

