import { getExternalSourcesConfig, SOURCE_DEFINITIONS } from './config';
import { BneDigitalAdapter } from './adapters/bne-digital.adapter';
import { CervantesVirtualAdapter } from './adapters/cervantes-virtual.adapter';
import { CurriculumCraCatalogAdapter } from './adapters/curriculum-cra-catalog.adapter';
import { ElejandriaAdapter } from './adapters/elejandria.adapter';
import { MemoriaChilenaAdapter } from './adapters/memoria-chilena.adapter';
import { MineducBibliotecaDigitalAdapter } from './adapters/mineduc-biblioteca-digital.adapter';
import { ProjectGutenbergAdapter } from './adapters/project-gutenberg.adapter';
import { WikisourceEsAdapter } from './adapters/wikisource-es.adapter';
import type { SourceAdapter, SourceKey } from './types';

const ADAPTERS: Record<SourceKey, SourceAdapter> = {
  wikisource_es: WikisourceEsAdapter,
  cervantes_virtual: CervantesVirtualAdapter,
  mineduc_biblioteca_digital: MineducBibliotecaDigitalAdapter,
  memoria_chilena: MemoriaChilenaAdapter,
  bne_digital: BneDigitalAdapter,
  elejandria: ElejandriaAdapter,
  project_gutenberg: ProjectGutenbergAdapter,
  curriculum_cra_catalog: CurriculumCraCatalogAdapter,
};

export function getAdapter(source: SourceKey) {
  return ADAPTERS[source];
}

export function listEnabledAdapters() {
  const config = getExternalSourcesConfig();
  return (Object.keys(ADAPTERS) as SourceKey[])
    .filter((key) => config.enabledSources[key])
    .map((key) => ADAPTERS[key]);
}

export function listEnabledSourceDefinitions() {
  const config = getExternalSourcesConfig();
  return (Object.keys(SOURCE_DEFINITIONS) as SourceKey[])
    .filter((key) => config.enabledSources[key])
    .map((key) => ({
      key,
      ...SOURCE_DEFINITIONS[key],
    }));
}
