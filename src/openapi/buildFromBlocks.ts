import * as Blockly from 'blockly'

export type OpenApiMvpSpec = {
  openapi: string
  info: { title: string; version: string }
  components?: {
    schemas: Record<string, Record<string, unknown>>
  }
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string
        responses: Record<
          string,
          {
            description: string
            content?: {
              'application/json': {
                schema: Record<string, unknown>
              }
            }
          }
        >
      }
    >
  >
}

function chainFrom(first: Blockly.Block | null): Blockly.Block[] {
  const out: Blockly.Block[] = []
  let cur: Blockly.Block | null = first
  while (cur) {
    out.push(cur)
    cur = cur.getNextBlock()
  }
  return out
}

function buildSchemaFromValue(block: Blockly.Block | null): Record<string, unknown> | undefined {
  if (!block) return undefined
  if (block.type === 'openapi_schema_primitive') {
    const type = String(block.getFieldValue('TYPE') ?? 'string')
    const formatRaw = String(block.getFieldValue('FORMAT') ?? '')
    const format = formatRaw.trim()
    return format ? { type, format } : { type }
  }
  if (block.type === 'openapi_schema_ref') {
    const name = String(block.getFieldValue('REF_NAME') ?? '').trim()
    if (!name) return undefined
    return { $ref: `#/components/schemas/${name}` }
  }
  return undefined
}

export function buildOpenApiMvpFromWorkspace(workspace: Blockly.Workspace): OpenApiMvpSpec | null {
  const roots = workspace.getTopBlocks(false).filter((b) => b.type === 'openapi_root')
  const root = roots[0]
  if (!root) return null

  const openapi = String(root.getFieldValue('OPENAPI_VERSION') ?? '3.0.3')
  const title = String(root.getFieldValue('TITLE') ?? 'Mon API').trim() || 'Mon API'
  const version = String(root.getFieldValue('API_VERSION') ?? '1.0.0').trim() || '1.0.0'

  const schemas: Record<string, Record<string, unknown>> = {}
  const firstSchemaDef = root.getInputTargetBlock('SCHEMA_DEFS')
  for (const defBlock of chainFrom(firstSchemaDef)) {
    if (defBlock.type !== 'openapi_schema_def') continue
    const schemaName = String(defBlock.getFieldValue('SCHEMA_NAME') ?? '').trim()
    if (!schemaName) continue
    const inner = defBlock.getInputTargetBlock('SCHEMA')
    const built = buildSchemaFromValue(inner)
    if (built) schemas[schemaName] = built
  }

  const paths: OpenApiMvpSpec['paths'] = {}

  const firstPath = root.getInputTargetBlock('PATHS')
  for (const pathBlock of chainFrom(firstPath)) {
    if (pathBlock.type !== 'openapi_path') continue
    const pathKey = String(pathBlock.getFieldValue('PATH') ?? '').trim()
    if (!pathKey) continue
    paths[pathKey] ??= {}

    const firstMethod = pathBlock.getInputTargetBlock('METHODS')
    for (const methodBlock of chainFrom(firstMethod)) {
      if (methodBlock.type !== 'openapi_method') continue
      const verb = String(methodBlock.getFieldValue('VERB') ?? '').trim()
      if (!verb) continue

      const summaryRaw = String(methodBlock.getFieldValue('SUMMARY') ?? '').trim()
      const responses: Record<string, { description: string; content?: any }> = {}

      const firstResp = methodBlock.getInputTargetBlock('RESPONSES')
      for (const respBlock of chainFrom(firstResp)) {
        if (respBlock.type !== 'openapi_response') continue
        const status = String(respBlock.getFieldValue('STATUS') ?? '').trim()
        if (!status) continue
        const description =
          String(respBlock.getFieldValue('DESCRIPTION') ?? '').trim() || '(sans description)'

        const schemaValueBlock = respBlock.getInputTargetBlock('SCHEMA')
        const schema = buildSchemaFromValue(schemaValueBlock)
        responses[status] = schema
          ? { description, content: { 'application/json': { schema } } }
          : { description }
      }

      // OpenAPI exige responses. Pour le MVP, on auto-ajoute un 200 si absent.
      if (Object.keys(responses).length === 0) {
        responses['200'] = { description: 'OK' }
      }

      paths[pathKey][verb] = {
        ...(summaryRaw ? { summary: summaryRaw } : {}),
        responses,
      }
    }
  }

  const spec: OpenApiMvpSpec = {
    openapi,
    info: { title, version },
    paths,
  }
  if (Object.keys(schemas).length > 0) {
    spec.components = { schemas }
  }
  return spec
}

