import * as Blockly from 'blockly'
import { dump as dumpYaml } from 'js-yaml'
import { registerOpenApiMvpBlocks } from './blocks'
import { buildOpenApiMvpFromWorkspace } from './buildFromBlocks'

const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Document',
      colour: '#7c3aed',
      contents: [{ kind: 'block', type: 'openapi_root' }],
    },
    {
      kind: 'category',
      name: 'Paths et opérations',
      colour: '#2563eb',
      contents: [
        { kind: 'block', type: 'openapi_path' },
        { kind: 'block', type: 'openapi_method' },
        { kind: 'block', type: 'openapi_response' },
      ],
    },
    {
      kind: 'category',
      name: 'Schémas réutilisables',
      colour: '#ca8a04',
      contents: [{ kind: 'block', type: 'openapi_schema_def' }],
    },
    {
      kind: 'category',
      name: 'Construire un schéma',
      colour: '#059669',
      contents: [
        { kind: 'block', type: 'openapi_schema_ref' },
        { kind: 'block', type: 'openapi_schema_primitive' },
        { kind: 'block', type: 'openapi_schema_object' },
        { kind: 'block', type: 'openapi_schema_property' },
        { kind: 'block', type: 'openapi_schema_array' },
        { kind: 'block', type: 'openapi_schema_allOf' },
        { kind: 'block', type: 'openapi_schema_oneOf' },
        { kind: 'block', type: 'openapi_schema_anyOf' },
      ],
    },
    {
      kind: 'category',
      name: 'Sécurité',
      colour: '#64748b',
      contents: [
        { kind: 'label', text: 'Schémas (components.securitySchemes)' },
        { kind: 'block', type: 'openapi_security_scheme_jwt' },
        { kind: 'block', type: 'openapi_security_scheme_header' },
        { kind: 'label', text: 'Exigences (security)' },
        { kind: 'block', type: 'openapi_security_requirement' },
      ],
    },
  ],
}

function assertEl<T extends HTMLElement>(el: Element | null, label: string): T {
  if (!el) throw new Error(`Élément manquant: ${label}`)
  return el as T
}

export function mountOpenApiBuilder(root: HTMLDivElement) {
  registerOpenApiMvpBlocks()

  type OutputMode = 'yaml' | 'json'
  let outputMode: OutputMode = 'yaml'
  let lastYaml: string | null = null
  let lastJson: string | null = null

  root.innerHTML = `
  <div class="appShell">
    <header class="topbar">
      <div class="brand">
        <div class="brandTitle">OpenAPI Visual Builder (MVP)</div>
        <div class="brandSubtitle">Blocs emboîtables → OpenAPI (YAML/JSON) + export/import XML</div>
      </div>
      <div class="actions">
        <button id="btnNew" type="button">Nouveau</button>
        <button id="btnExport" type="button">Exporter XML</button>
        <button id="btnImport" type="button">Importer XML</button>
        <button id="btnGen" type="button" class="primary">Générer OpenAPI</button>
      </div>
    </header>

    <main class="main">
      <section class="paneLeft">
        <div id="blocklyDiv" class="blocklyHost" aria-label="Éditeur Blockly"></div>
      </section>

      <section class="paneRight">
        <div class="panel">
          <div class="panelTitle">XML (workspace)</div>
          <textarea id="xmlArea" spellcheck="false" placeholder="Clique sur “Exporter XML”, ou colle un XML puis “Importer XML”…"></textarea>
        </div>

        <div class="panel">
          <div class="panelTitle panelTitleRow">
            <span>OpenAPI généré</span>
            <span class="toggleGroup" role="tablist" aria-label="Format de sortie">
              <button id="btnShowYaml" type="button" class="toggleBtn isActive" role="tab" aria-selected="true">YAML</button>
              <button id="btnShowJson" type="button" class="toggleBtn" role="tab" aria-selected="false">JSON</button>
            </span>
          </div>
          <textarea id="codeArea" spellcheck="false" placeholder="Clique sur “Générer OpenAPI”…"></textarea>
        </div>
      </section>
    </main>
  </div>
  `

  const blocklyDiv = assertEl<HTMLDivElement>(root.querySelector('#blocklyDiv'), '#blocklyDiv')
  const btnNew = assertEl<HTMLButtonElement>(root.querySelector('#btnNew'), '#btnNew')
  const btnExport = assertEl<HTMLButtonElement>(root.querySelector('#btnExport'), '#btnExport')
  const btnImport = assertEl<HTMLButtonElement>(root.querySelector('#btnImport'), '#btnImport')
  const btnGen = assertEl<HTMLButtonElement>(root.querySelector('#btnGen'), '#btnGen')
  const btnShowYaml = assertEl<HTMLButtonElement>(root.querySelector('#btnShowYaml'), '#btnShowYaml')
  const btnShowJson = assertEl<HTMLButtonElement>(root.querySelector('#btnShowJson'), '#btnShowJson')
  const xmlArea = assertEl<HTMLTextAreaElement>(root.querySelector('#xmlArea'), '#xmlArea')
  const codeArea = assertEl<HTMLTextAreaElement>(root.querySelector('#codeArea'), '#codeArea')

  const setMode = (mode: OutputMode) => {
    outputMode = mode
    const isYaml = mode === 'yaml'
    btnShowYaml.classList.toggle('isActive', isYaml)
    btnShowJson.classList.toggle('isActive', !isYaml)
    btnShowYaml.setAttribute('aria-selected', String(isYaml))
    btnShowJson.setAttribute('aria-selected', String(!isYaml))
    if (isYaml) codeArea.value = lastYaml ?? codeArea.value
    else codeArea.value = lastJson ?? codeArea.value
  }

  btnShowYaml.addEventListener('click', () => setMode('yaml'))
  btnShowJson.addEventListener('click', () => setMode('json'))

  const workspace = Blockly.inject(blocklyDiv, {
    toolbox: TOOLBOX,
    theme: Blockly.Themes.Classic,
    trashcan: true,
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.9,
      maxScale: 2,
      minScale: 0.4,
      scaleSpeed: 1.1,
    },
    grid: {
      spacing: 20,
      length: 3,
      colour: '#d1d5db',
      snap: true,
    },
  })

  const resize = () => Blockly.svgResize(workspace)
  window.addEventListener('resize', resize)
  resize()

  btnNew.addEventListener('click', () => {
    workspace.clear()
    xmlArea.value = ''
    codeArea.value = ''
    lastYaml = null
    lastJson = null
    setMode('yaml')
  })

  btnExport.addEventListener('click', () => {
    const xml = Blockly.Xml.workspaceToDom(workspace)
    xmlArea.value = Blockly.Xml.domToPrettyText(xml)
  })

  btnImport.addEventListener('click', () => {
    const text = xmlArea.value.trim()
    if (!text) return
    const xml = Blockly.utils.xml.textToDom(text)
    workspace.clear()
    Blockly.Xml.domToWorkspace(xml, workspace)
  })

  btnGen.addEventListener('click', () => {
    const spec = buildOpenApiMvpFromWorkspace(workspace)
    if (!spec) {
      codeArea.value =
        'Ajoute le bloc racine “OpenAPI …” depuis la toolbox, puis clique sur “Générer OpenAPI”.'
      lastYaml = null
      lastJson = null
      setMode('yaml')
      return
    }

    lastYaml = dumpYaml(spec, { noRefs: true, lineWidth: 120 })
    lastJson = JSON.stringify(spec, null, 2)
    codeArea.value = outputMode === 'yaml' ? lastYaml : lastJson
  })

  const KEY = 'openapi-mvp-blockly-xml-v1'
  const saved = localStorage.getItem(KEY)
  if (saved) {
    try {
      const xml = Blockly.utils.xml.textToDom(saved)
      Blockly.Xml.domToWorkspace(xml, workspace)
    } catch {
      // ignore
    }
  }

  workspace.addChangeListener(() => {
    try {
      const xml = Blockly.Xml.workspaceToDom(workspace)
      localStorage.setItem(KEY, Blockly.Xml.domToText(xml))
    } catch {
      // ignore
    }
  })
}
