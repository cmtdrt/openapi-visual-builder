import * as Blockly from 'blockly'

export type OpenApiMvpSpec = {
  openapi: string
  info: { title: string; version: string }
  components?: {
    schemas: Record<string, Record<string, unknown>>
    securitySchemes?: Record<string, Record<string, unknown>>
  }
  security?: Array<Record<string, string[]>>
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string
        security?: Array<Record<string, string[]>>
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

/** Exemple saisi : JSON si parse OK, sinon chaîne brute. */
function parseExampleInput(raw: string): unknown | undefined {
  const t = raw.trim()
  if (!t) return undefined
  try {
    return JSON.parse(t) as unknown
  } catch {
    return raw
  }
}

/**
 * Ajoute description / example sur un schéma.
 * Si c’est uniquement un $ref (OAS 3.0 interdit les frères) → allOf + métadonnées.
 */
function applySchemaMetadata(
  base: Record<string, unknown>,
  opts: { description?: string; example?: unknown },
): Record<string, unknown> {
  const desc = opts.description?.trim()
  const ex = opts.example
  const hasDesc = Boolean(desc)
  const hasEx = ex !== undefined

  if (!hasDesc && !hasEx) return base

  const onlyRef = Object.keys(base).length === 1 && typeof base.$ref === 'string'
  if (onlyRef) {
    const out: Record<string, unknown> = { allOf: [base] }
    if (hasDesc) out.description = desc
    if (hasEx) out.example = ex
    return out
  }

  const out = { ...base }
  if (hasDesc) out.description = desc
  if (hasEx) out.example = ex
  return out
}

function buildComposableList(
  block: Blockly.Block,
  keys: string[],
  wrapperKey: 'allOf' | 'oneOf' | 'anyOf',
): Record<string, unknown> | undefined {
  const parts = keys
    .map((k) => buildSchemaFromValue(block.getInputTargetBlock(k)))
    .filter((p): p is Record<string, unknown> => Boolean(p))
  if (parts.length === 0) return undefined
  if (parts.length === 1) return parts[0]
  return { [wrapperKey]: parts }
}

function buildSchemaFromValue(block: Blockly.Block | null): Record<string, unknown> | undefined {
  if (!block) return undefined

  if (block.type === 'openapi_schema_property') {
    return undefined
  }

  if (block.type === 'openapi_schema_primitive') {
    const type = String(block.getFieldValue('TYPE') ?? 'string')
    const formatRaw = String(block.getFieldValue('FORMAT') ?? '')
    const format = formatRaw.trim()
    const base = format ? { type, format } : { type }
    const desc = String(block.getFieldValue('DESCRIPTION') ?? '').trim()
    const ex = parseExampleInput(String(block.getFieldValue('EXAMPLE') ?? ''))
    return applySchemaMetadata(base, { description: desc || undefined, example: ex })
  }

  if (block.type === 'openapi_schema_ref') {
    const name = String(block.getFieldValue('REF_NAME') ?? '').trim()
    if (!name) return undefined
    const base = { $ref: `#/components/schemas/${name}` }
    const desc = String(block.getFieldValue('DESCRIPTION') ?? '').trim()
    const ex = parseExampleInput(String(block.getFieldValue('EXAMPLE') ?? ''))
    return applySchemaMetadata(base, { description: desc || undefined, example: ex })
  }

  if (block.type === 'openapi_schema_object') {
    const desc = String(block.getFieldValue('DESCRIPTION') ?? '').trim()
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    const firstProp = block.getInputTargetBlock('PROPERTIES')
    for (const propBlock of chainFrom(firstProp)) {
      if (propBlock.type !== 'openapi_schema_property') continue
      const name = String(propBlock.getFieldValue('NAME') ?? '').trim()
      if (!name) continue

      const inner = buildSchemaFromValue(propBlock.getInputTargetBlock('VALUE'))
      if (!inner) continue

      const pDesc = String(propBlock.getFieldValue('DESCRIPTION') ?? '').trim()
      const pEx = parseExampleInput(String(propBlock.getFieldValue('EXAMPLE') ?? ''))
      properties[name] = applySchemaMetadata(inner, {
        description: pDesc || undefined,
        example: pEx,
      })

      if (propBlock.getFieldValue('REQUIRED') === 'TRUE') required.push(name)
    }

    const obj: Record<string, unknown> = { type: 'object', properties }
    if (required.length > 0) obj.required = [...new Set(required)]
    if (desc) obj.description = desc
    return obj
  }

  if (block.type === 'openapi_schema_array') {
    const desc = String(block.getFieldValue('DESCRIPTION') ?? '').trim()
    const items = buildSchemaFromValue(block.getInputTargetBlock('ITEMS'))
    const arr: Record<string, unknown> = { type: 'array' }
    if (items) arr.items = items
    if (desc) arr.description = desc
    return arr
  }

  if (block.type === 'openapi_schema_allOf') {
    return buildComposableList(block, ['A', 'B', 'C'], 'allOf')
  }
  if (block.type === 'openapi_schema_oneOf') {
    return buildComposableList(block, ['A', 'B', 'C'], 'oneOf')
  }
  if (block.type === 'openapi_schema_anyOf') {
    return buildComposableList(block, ['A', 'B', 'C'], 'anyOf')
  }

  return undefined
}

function buildSecuritySchemesFromRoot(
  root: Blockly.Block,
): Record<string, Record<string, unknown>> | undefined {
  const schemes: Record<string, Record<string, unknown>> = {}
  const first = root.getInputTargetBlock('SECURITY_SCHEMES')
  for (const b of chainFrom(first)) {
    const id = String(b.getFieldValue('SCHEME_ID') ?? '').trim()
    if (!id) continue

    if (b.type === 'openapi_security_scheme_jwt') {
      const description = String(b.getFieldValue('DESCRIPTION') ?? '').trim()
      const bearerFormat = String(b.getFieldValue('BEARER_FORMAT') ?? '').trim()
      schemes[id] = {
        type: 'http',
        scheme: 'bearer',
        ...(bearerFormat ? { bearerFormat } : {}),
        ...(description ? { description } : {}),
      }
      continue
    }

    if (b.type === 'openapi_security_scheme_header') {
      const headerName = String(b.getFieldValue('HEADER_NAME') ?? '').trim()
      const description = String(b.getFieldValue('DESCRIPTION') ?? '').trim()
      if (!headerName) continue
      schemes[id] = {
        type: 'apiKey',
        in: 'header',
        name: headerName,
        ...(description ? { description } : {}),
      }
      continue
    }
  }

  return Object.keys(schemes).length > 0 ? schemes : undefined
}

function buildSecurityRequirementListFromStatement(
  firstReq: Blockly.Block | null,
): Array<Record<string, string[]>> | undefined {
  const out: Array<Record<string, string[]>> = []
  for (const b of chainFrom(firstReq)) {
    if (b.type !== 'openapi_security_requirement') continue
    const id = String(b.getFieldValue('SCHEME_ID') ?? '').trim()
    if (!id) continue
    out.push({ [id]: [] })
  }
  return out.length > 0 ? out : undefined
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

  const globalSecurity = buildSecurityRequirementListFromStatement(
    root.getInputTargetBlock('GLOBAL_SECURITY'),
  )

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
      const securityMode = String(methodBlock.getFieldValue('SECURITY_MODE') ?? 'inherit')
      const operationSecurity =
        securityMode === 'override'
          ? buildSecurityRequirementListFromStatement(methodBlock.getInputTargetBlock('SECURITY'))
          : securityMode === 'none'
            ? []
            : undefined
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
        ...(operationSecurity !== undefined ? { security: operationSecurity } : {}),
        responses,
      }
    }
  }

  const spec: OpenApiMvpSpec = {
    openapi,
    info: { title, version },
    ...(globalSecurity ? { security: globalSecurity } : {}),
    paths,
  }

  const securitySchemes = buildSecuritySchemesFromRoot(root)
  if (Object.keys(schemas).length > 0 || securitySchemes) {
    spec.components = {
      schemas,
      ...(securitySchemes ? { securitySchemes } : {}),
    }
  }
  return spec
}

