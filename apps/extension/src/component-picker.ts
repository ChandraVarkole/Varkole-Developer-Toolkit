export type ComponentKindHint = 'lwc' | 'aura' | 'unknown';

export interface PickedComponentContext {
  componentName: string;
  kindHint: ComponentKindHint;
  namespace?: string;
  tagName?: string;
  descriptor?: string;
  metadataType?: 'QuickAction' | 'CustomTab' | 'Flow';
  metadataName?: string;
}

export type ComponentPickResult =
  | { status: 'found'; component: PickedComponentContext }
  | { status: 'cancelled'; message: string }
  | { status: 'not-found'; message: string };

export type ComponentPickResultMessage = ComponentPickResult & {
  type: 'VARKOLE_COMPONENT_PICK_RESULT';
};

interface ComponentMetadata {
  tagName?: string | undefined;
  auraClass?: string | undefined;
}

const SALESFORCE_NAMESPACES = new Set([
  'aura',
  'flexipage',
  'flowbuilder',
  'flowruntime',
  'force',
  'forcechatter',
  'instrumentation',
  'lightning',
  'lightningcommunity',
  'lightning-formatted',
  'lightning-primitive',
  'lightning-input',
  'lightning-base',
  'navex',
  'one',
  'records',
  'runtime',
  'runtime_platform',
  'runtime_sales',
  'runtime_service',
  'ui',
]);

const COMPONENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,159}$/;
const COMPONENT_NAMESPACE = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const QUICK_ACTION_NAME = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/;
const METADATA_NAME = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/;

/**
 * Converts component identity markers into a Salesforce metadata lookup hint.
 * It intentionally accepts only tag names and Aura descriptors; rendered text,
 * input values, record fields, and arbitrary page attributes are never read.
 */
export function componentHintFromMetadata(
  metadata: ComponentMetadata,
): PickedComponentContext | undefined {
  const aura = parseAuraDescriptor(metadata.auraClass);
  if (aura) return aura;

  const tagName = metadata.tagName?.trim().toLowerCase();
  if (!tagName || !tagName.includes('-')) return undefined;
  const separator = tagName.indexOf('-');
  const namespace = tagName.slice(0, separator);
  const localName = tagName.slice(separator + 1);
  if (
    !namespace ||
    !localName ||
    isSalesforceNamespace(namespace) ||
    !COMPONENT_NAMESPACE.test(namespace)
  ) {
    return undefined;
  }
  const componentName = kebabToDeveloperName(localName);
  if (!COMPONENT_NAME.test(componentName)) return undefined;
  return {
    componentName,
    kindHint: 'lwc',
    namespace,
    tagName,
  };
}

export function quickActionHintFromComposedPath(
  path: EventTarget[],
): PickedComponentContext | undefined {
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    const hint = quickActionHintFromSelectionName(
      target.getAttribute('data-target-selection-name') ?? undefined,
    );
    if (hint) return hint;
  }
  return undefined;
}

export function quickActionHintFromSelectionName(
  selectionName?: string,
): PickedComponentContext | undefined {
  const actionName = selectionName
    ?.trim()
    .match(/^sfdc:QuickAction\.([A-Za-z][A-Za-z0-9_.]*)$/)?.[1];
  if (!actionName || !QUICK_ACTION_NAME.test(actionName)) return undefined;
  return {
    componentName: actionName.split('.').at(-1)!,
    kindHint: 'unknown',
    metadataType: 'QuickAction',
    metadataName: actionName,
  };
}

export function navigationTabHintFromComposedPath(
  path: EventTarget[],
): PickedComponentContext | undefined {
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    const hint = navigationTabHintFromValues(
      target.getAttribute('data-target-selection-name') ?? undefined,
      target instanceof HTMLAnchorElement
        ? target.href
        : (target.getAttribute('href') ?? undefined),
    );
    if (hint) return hint;
  }
  return undefined;
}

export function navigationTabHintFromValues(
  selectionName?: string,
  href?: string,
): PickedComponentContext | undefined {
  const selectionMatch = selectionName
    ?.trim()
    .match(/^sfdc:TabDefinition\.([A-Za-z][A-Za-z0-9_]*)$/)?.[1];
  let routeMatch: string | undefined;
  if (href) {
    try {
      routeMatch = new URL(href, 'https://salesforce.invalid').pathname.match(
        /\/lightning\/n\/([A-Za-z][A-Za-z0-9_]*)/i,
      )?.[1];
    } catch {
      // An invalid href is not a Salesforce tab identity.
    }
  }
  const tabName = selectionMatch ?? routeMatch;
  if (!tabName || !METADATA_NAME.test(tabName)) return undefined;
  return {
    componentName: tabName,
    kindHint: 'unknown',
    metadataType: 'CustomTab',
    metadataName: tabName,
  };
}

export function flowHintFromComposedPath(path: EventTarget[]): PickedComponentContext | undefined {
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    const flowName = ['flow-api-name', 'data-flow-api-name', 'flow-name', 'data-flow-name']
      .map((attribute) => target.getAttribute(attribute)?.trim())
      .find((value) => value && METADATA_NAME.test(value));
    if (!flowName) continue;
    return {
      componentName: flowName,
      kindHint: 'unknown',
      metadataType: 'Flow',
      metadataName: flowName,
    };
  }
  return undefined;
}

export function componentHintFromElement(element: Element): PickedComponentContext | undefined {
  return componentHintFromMetadata({
    tagName: element.tagName,
    auraClass: element.getAttribute('data-aura-class') ?? undefined,
  });
}

export function componentHintFromComposedPath(
  path: EventTarget[],
): PickedComponentContext | undefined {
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    const hint = componentHintFromElement(target);
    if (hint) return hint;
  }
  return undefined;
}

export function isComponentPickResultMessage(value: unknown): value is ComponentPickResultMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as {
    type?: unknown;
    status?: unknown;
    message?: unknown;
    component?: unknown;
  };
  if (message.type !== 'VARKOLE_COMPONENT_PICK_RESULT') return false;
  if (message.status === 'cancelled' || message.status === 'not-found') {
    return typeof message.message === 'string' && message.message.length <= 500;
  }
  if (message.status !== 'found' || !message.component || typeof message.component !== 'object') {
    return false;
  }
  const component = message.component as Record<string, unknown>;
  return (
    typeof component.componentName === 'string' &&
    COMPONENT_NAME.test(component.componentName) &&
    (component.kindHint === 'lwc' ||
      component.kindHint === 'aura' ||
      component.kindHint === 'unknown') &&
    (component.namespace === undefined ||
      (typeof component.namespace === 'string' && COMPONENT_NAMESPACE.test(component.namespace))) &&
    (component.tagName === undefined ||
      (typeof component.tagName === 'string' && component.tagName.length <= 240)) &&
    (component.descriptor === undefined ||
      (typeof component.descriptor === 'string' && component.descriptor.length <= 240)) &&
    (component.metadataType === undefined ||
      component.metadataType === 'QuickAction' ||
      component.metadataType === 'CustomTab' ||
      component.metadataType === 'Flow') &&
    (component.metadataName === undefined ||
      (typeof component.metadataName === 'string' && METADATA_NAME.test(component.metadataName)))
  );
}

function parseAuraDescriptor(value?: string): PickedComponentContext | undefined {
  if (!value) return undefined;
  const descriptor = value.trim();
  const match = descriptor.match(/^([A-Za-z][A-Za-z0-9_]*):([A-Za-z][A-Za-z0-9_]*)$/);
  if (!match) return undefined;
  const namespace = match[1]!;
  const componentName = match[2]!;
  if (isSalesforceNamespace(namespace.toLowerCase())) return undefined;
  return {
    componentName,
    kindHint: 'aura',
    namespace,
    descriptor,
  };
}

function isSalesforceNamespace(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    SALESFORCE_NAMESPACES.has(normalized) ||
    /^(?:runtime_|flowruntime(?:_|$)|flowbuilder(?:_|$)|force(?:_|$)|lightning(?:_|$)|records(?:_|$)|flexipage(?:_|$)|aura(?:_|$)|ui(?:_|$)|one(?:_|$)|navex(?:_|$)|instrumentation(?:_|$))/.test(
      normalized,
    )
  );
}

function kebabToDeveloperName(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}
