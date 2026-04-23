import type {
  EngineItemV2,
  EngineMenuV2,
  EngineSectionV2,
  SelectionConfigV2,
  TemplateV2,
  TileInstanceV2,
} from './engine-types-v2'
import {
  createFlagshipTile,
  createItemTile,
  createLogoTile,
  createSectionHeaderTile,
} from './tile-placer'

export type LeadRowStartKind = 'section-start' | 'continuation'
export type LeadRowCandidateKind = 'logo' | 'header' | 'flagship' | 'item'
export type LeadRowTemplateProfile =
  | '1-column-tall'
  | '2-column-portrait'
  | '3-column-portrait'
  | '4-column-portrait'
  | '5-column-landscape'
  | '6-column-portrait-a3'
  | 'generic'

export interface LeadRowCandidateTile {
  kind: LeadRowCandidateKind
  sectionId: string
  tile: Omit<TileInstanceV2, 'x' | 'y' | 'gridRow' | 'gridCol'>
  consumesLeadRowCapacity: boolean
}

export interface LeadRowWidthRule {
  profile: LeadRowTemplateProfile
  templateId: string
  columns: number
  sharedLeadRowSupported: boolean
  preferredLeadRowKinds: ReadonlyArray<'logo' | 'header' | 'flagship'>
  maxLeadRowItems: number
  flagshipFallback: 'next-row'
}

export interface LeadRowPlanV2 {
  sectionId: string
  startKind: LeadRowStartKind
  widthRule: LeadRowWidthRule
  candidates: LeadRowCandidateTile[]
  chosenTiles: LeadRowCandidateTile[]
  queuedTiles: LeadRowCandidateTile[]
}

export interface SectionPlanV2 {
  section: EngineSectionV2
  hasDividerBefore: boolean
  leadRow: LeadRowPlanV2
}

function getTemplateProfile(template: TemplateV2): LeadRowTemplateProfile {
  switch (template.id) {
    case '1-column-tall':
    case '2-column-portrait':
    case '3-column-portrait':
    case '4-column-portrait':
    case '5-column-landscape':
    case '6-column-portrait-a3':
      return template.id
    default:
      return 'generic'
  }
}

export function resolveLeadRowWidthRule(template: TemplateV2): LeadRowWidthRule {
  const profile = getTemplateProfile(template)
  const columns = template.body.container.cols

  switch (profile) {
    case '1-column-tall':
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: false,
        preferredLeadRowKinds: ['logo', 'header'],
        maxLeadRowItems: 0,
        flagshipFallback: 'next-row',
      }
    case '2-column-portrait':
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: true,
        preferredLeadRowKinds: ['logo', 'header', 'flagship'],
        maxLeadRowItems: 0,
        flagshipFallback: 'next-row',
      }
    case '3-column-portrait':
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: true,
        preferredLeadRowKinds: ['logo', 'header', 'flagship'],
        maxLeadRowItems: 1,
        flagshipFallback: 'next-row',
      }
    case '4-column-portrait':
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: true,
        preferredLeadRowKinds: ['logo', 'header', 'flagship'],
        maxLeadRowItems: 0,
        flagshipFallback: 'next-row',
      }
    case '5-column-landscape':
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: true,
        preferredLeadRowKinds: ['logo', 'header', 'flagship'],
        maxLeadRowItems: 1,
        flagshipFallback: 'next-row',
      }
    case '6-column-portrait-a3':
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: true,
        preferredLeadRowKinds: ['logo', 'header', 'flagship'],
        maxLeadRowItems: 2,
        flagshipFallback: 'next-row',
      }
    default:
      return {
        profile,
        templateId: template.id,
        columns,
        sharedLeadRowSupported: columns > 1,
        preferredLeadRowKinds: ['logo', 'header', 'flagship'],
        maxLeadRowItems: Math.max(0, columns - 2),
        flagshipFallback: 'next-row',
      }
  }
}

function getFlagshipBySection(
  menu: EngineMenuV2,
  template: TemplateV2,
  selection?: SelectionConfigV2
): Map<string, EngineItemV2> {
  if (selection?.showFlagshipTile !== true || !template.tiles.FLAGSHIP_CARD) {
    return new Map<string, EngineItemV2>()
  }

  for (const section of menu.sections) {
    const flagship = section.items.find(item => item.isFlagship)
    if (flagship) {
      return new Map<string, EngineItemV2>([[section.id, flagship]])
    }
  }

  return new Map<string, EngineItemV2>()
}

function buildRegularItemCandidates(
  items: EngineItemV2[],
  sectionId: string,
  template: TemplateV2,
  currency: string,
  selection?: SelectionConfigV2
): LeadRowCandidateTile[] {
  return items.map(item => ({
    kind: 'item',
    sectionId,
    tile: createItemTile(item, sectionId, template, currency, selection),
    consumesLeadRowCapacity: true,
  }))
}

function deriveSectionSelection(
  section: EngineSectionV2,
  selection?: SelectionConfigV2
): SelectionConfigV2 | undefined {
  if (section.hasImages === false && !selection?.textOnly) {
    return { ...selection, textOnly: true }
  }

  return selection
}

function selectLeadRowTiles(
  widthRule: LeadRowWidthRule,
  candidates: LeadRowCandidateTile[],
  regularItems: LeadRowCandidateTile[]
): { chosenTiles: LeadRowCandidateTile[]; queuedTiles: LeadRowCandidateTile[] } {
  if (candidates.length === 0 && regularItems.length === 0) {
    return { chosenTiles: [], queuedTiles: [] }
  }

  if (!widthRule.sharedLeadRowSupported) {
    const firstLeadTile = candidates.find(candidate => candidate.kind === 'logo')
      ?? candidates.find(candidate => candidate.kind === 'header')
      ?? candidates.find(candidate => candidate.kind === 'flagship')
      ?? regularItems[0]
    const chosenTiles = firstLeadTile ? [firstLeadTile] : []
    const chosenIds = new Set(chosenTiles.map(candidate => candidate.tile.id))

    return {
      chosenTiles,
      queuedTiles: [...candidates, ...regularItems].filter(candidate => !chosenIds.has(candidate.tile.id)),
    }
  }

  const chosenTiles: LeadRowCandidateTile[] = []
  let usedColumns = 0

  for (const kind of widthRule.preferredLeadRowKinds) {
    const candidate = candidates.find(entry => entry.kind === kind)
    if (!candidate) continue
    if (usedColumns + candidate.tile.colSpan > widthRule.columns) continue
    chosenTiles.push(candidate)
    usedColumns += candidate.tile.colSpan
  }

  const hasHeaderCandidate = candidates.some(candidate => candidate.kind === 'header')
  const headerChosen = chosenTiles.some(candidate => candidate.kind === 'header')

  if (hasHeaderCandidate && !headerChosen) {
    // The section header exists but didn't fit in the lead row (e.g. a full-width header
    // after the logo tile). Keep only the logo so it anchors the top of the section;
    // everything else — including any flagship that squeezed into the lead row — must
    // follow the header to preserve correct section ordering.
    const logoOnly = chosenTiles.filter(t => t.kind === 'logo')
    const logoIds = new Set(logoOnly.map(t => t.tile.id))
    const allQueued = [
      ...candidates.filter(t => !logoIds.has(t.tile.id)), // header first, then flagship
      ...regularItems,
    ]
    return {
      chosenTiles: logoOnly,
      queuedTiles: allQueued,
    }
  }

  let itemCount = 0
  for (const item of regularItems) {
    if (itemCount >= widthRule.maxLeadRowItems) break
    if (usedColumns + item.tile.colSpan > widthRule.columns) break
    chosenTiles.push(item)
    usedColumns += item.tile.colSpan
    itemCount++
  }

  const chosenIds = new Set(chosenTiles.map(candidate => candidate.tile.id))
  const specialQueue = candidates.filter(candidate => !chosenIds.has(candidate.tile.id))
  const itemQueue = regularItems.filter(candidate => !chosenIds.has(candidate.tile.id))

  return {
    chosenTiles,
    queuedTiles: [...specialQueue, ...itemQueue],
  }
}

export function buildSectionLeadRowPlan(
  menu: EngineMenuV2,
  section: EngineSectionV2,
  template: TemplateV2,
  selection?: SelectionConfigV2
): LeadRowPlanV2 {
  const widthRule = resolveLeadRowWidthRule(template)
  const sortedNonEmptySections = [...menu.sections]
    .filter(candidate => candidate.items.length > 0)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const firstNonEmptySectionId = sortedNonEmptySections[0]?.id
  const flagshipBySection = getFlagshipBySection(menu, template, selection)
  const sectionSelection = deriveSectionSelection(section, selection)
  const sortedItems = [...section.items].sort((left, right) => left.sortOrder - right.sortOrder)
  const flagshipItem = flagshipBySection.get(section.id)
  const regularItems = flagshipItem
    ? sortedItems.filter(item => item.id !== flagshipItem.id)
    : sortedItems
  const candidates: LeadRowCandidateTile[] = []

  if (selection?.showLogoTile === true && section.id === firstNonEmptySectionId) {
    candidates.push({
      kind: 'logo',
      sectionId: section.id,
      tile: createLogoTile(menu, template, sectionSelection, 'body', section.id),
      consumesLeadRowCapacity: true,
    })
  }

  if (selection?.showCategoryTitles !== false) {
    candidates.push({
      kind: 'header',
      sectionId: section.id,
      tile: createSectionHeaderTile(section, template, false, sectionSelection),
      consumesLeadRowCapacity: true,
    })
  }

  if (flagshipItem) {
    candidates.push({
      kind: 'flagship',
      sectionId: section.id,
      tile: createFlagshipTile(
        flagshipItem,
        section.id,
        template,
        menu.metadata.currency,
        sectionSelection
      ),
      consumesLeadRowCapacity: true,
    })
  }

  const regularItemCandidates = buildRegularItemCandidates(
    regularItems,
    section.id,
    template,
    menu.metadata.currency,
    sectionSelection
  )
  const { chosenTiles, queuedTiles } = selectLeadRowTiles(widthRule, candidates, regularItemCandidates)

  return {
    sectionId: section.id,
    startKind: 'section-start',
    widthRule,
    candidates: [...candidates, ...regularItemCandidates],
    chosenTiles,
    queuedTiles,
  }
}

export function buildContinuationLeadRowPlan(
  section: EngineSectionV2,
  template: TemplateV2,
  selection?: SelectionConfigV2
): LeadRowPlanV2 {
  const sectionSelection = deriveSectionSelection(section, selection)
  const headerTile = createSectionHeaderTile(section, template, true, sectionSelection)
  const widthRule = resolveLeadRowWidthRule(template)
  const headerCandidate: LeadRowCandidateTile = {
    kind: 'header',
    sectionId: section.id,
    tile: headerTile,
    consumesLeadRowCapacity: true,
  }

  return {
    sectionId: section.id,
    startKind: 'continuation',
    widthRule,
    candidates: [headerCandidate],
    chosenTiles: [headerCandidate],
    queuedTiles: [],
  }
}

export function buildSectionPlans(
  menu: EngineMenuV2,
  template: TemplateV2,
  selection?: SelectionConfigV2
): SectionPlanV2[] {
  const sortedSections = [...menu.sections].sort((left, right) => left.sortOrder - right.sortOrder)
  let nonEmptySectionIndex = 0

  return sortedSections.flatMap(section => {
    if (section.items.length === 0) {
      return []
    }

    const plan: SectionPlanV2 = {
      section,
      hasDividerBefore: !!template.dividers?.enabled && nonEmptySectionIndex > 0,
      leadRow: buildSectionLeadRowPlan(menu, section, template, selection),
    }
    nonEmptySectionIndex++
    return [plan]
  })
}
