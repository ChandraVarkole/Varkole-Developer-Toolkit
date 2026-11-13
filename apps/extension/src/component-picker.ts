export type ComponentKindHint = 'lwc' | 'aura' | 'unknown';

export interface PickedComponentContext {
  componentName: string;
  kindHint: ComponentKindHint;
  namespace?: string;
  tagName?: string;
  descriptor?: string;
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
    SALESFORCE_NAMESPACES.has(namespace) ||
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
      (typeof component.descriptor === 'string' && component.descriptor.length <= 240))
  );
}

function parseAuraDescriptor(value?: string): PickedComponentContext | undefined {
  if (!value) return undefined;
  const descriptor = value.trim();
  const match = descriptor.match(/^([A-Za-z][A-Za-z0-9_]*):([A-Za-z][A-Za-z0-9_]*)$/);
  if (!match) return undefined;
  const namespace = match[1]!;
  const componentName = match[2]!;
  if (SALESFORCE_NAMESPACES.has(namespace.toLowerCase())) return undefined;
  return {
    componentName,
    kindHint: 'aura',
    namespace,
    descriptor,
  };
}

function kebabToDeveloperName(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}
