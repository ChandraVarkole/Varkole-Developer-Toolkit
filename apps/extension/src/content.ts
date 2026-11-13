import { recordIdFromSalesforceUrl } from './record-context';
import {
  componentHintFromComposedPath,
  componentHintFromElement,
  type ComponentPickResultMessage,
  type PickedComponentContext,
} from './component-picker';

const HOST_ID = 'varkole-cloud-code-guru-root';
const PANEL_WIDTH_KEY = 'embedded-panel-width-v1';
const DEFAULT_PANEL_WIDTH_RATIO = 0.54;
const MIN_PANEL_WIDTH = 440;
const MAX_PANEL_WIDTH = 1280;

type PanelMessage = { type: 'TOGGLE_VARKOLE_PANEL' | 'OPEN_VARKOLE_PANEL' };

let panelWrapper: HTMLDivElement | undefined;
let panelFrame: HTMLIFrameElement | undefined;
let panelHost: HTMLDivElement | undefined;
let panelWidth: number | undefined;
let isOpen = false;
let componentPickerCleanup: (() => void) | undefined;

function initialize() {
  if (panelWrapper || document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  panelHost = host;
  host.id = HOST_ID;
  host.style.all = 'initial';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = PANEL_STYLES;

  const wrapper = document.createElement('div');
  panelWrapper = wrapper;

  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.type = 'button';
  launcher.title = 'Open Varkole Developer Toolkit';
  launcher.setAttribute('aria-label', 'Open Varkole Developer Toolkit');
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icons/icon-48.png');
  icon.alt = '';
  launcher.append(icon);

  const frame = document.createElement('iframe');
  panelFrame = frame;
  frame.className = 'panel';
  frame.title = 'Varkole Developer Toolkit';
  frame.allow = 'clipboard-write';
  const search = new URLSearchParams({ embedded: '1' });
  const recordId = recordIdFromSalesforceUrl(location.href);
  if (recordId) search.set('recordId', recordId);
  frame.src = chrome.runtime.getURL(`workspace.html?${search.toString()}#records`);

  const collapse = document.createElement('button');
  collapse.className = 'collapse';
  collapse.type = 'button';
  collapse.title = 'Hide Varkole';
  collapse.setAttribute('aria-label', 'Hide Varkole');
  collapse.textContent = '›';

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle';
  resizeHandle.tabIndex = 0;
  resizeHandle.setAttribute('role', 'separator');
  resizeHandle.setAttribute('aria-orientation', 'vertical');
  resizeHandle.setAttribute('aria-label', 'Resize Varkole panel');
  resizeHandle.setAttribute('aria-valuemin', String(MIN_PANEL_WIDTH));
  resizeHandle.setAttribute('aria-valuemax', String(MAX_PANEL_WIDTH));
  resizeHandle.title = 'Drag to resize · Double-click to reset';
  resizeHandle.textContent = '⋮';

  resizeHandle.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 900) return;
    event.preventDefault();
    resizeHandle.setPointerCapture(event.pointerId);
    resizeHandle.classList.add('dragging');
  });
  resizeHandle.addEventListener('pointermove', (event) => {
    if (!resizeHandle.hasPointerCapture(event.pointerId)) return;
    applyPanelWidth(window.innerWidth - event.clientX, false);
  });
  const finishResize = (event: PointerEvent) => {
    if (!resizeHandle.hasPointerCapture(event.pointerId)) return;
    resizeHandle.releasePointerCapture(event.pointerId);
    resizeHandle.classList.remove('dragging');
    if (panelWidth) void chrome.storage.local.set({ [PANEL_WIDTH_KEY]: panelWidth });
  };
  resizeHandle.addEventListener('pointerup', finishResize);
  resizeHandle.addEventListener('pointercancel', finishResize);
  resizeHandle.addEventListener('dblclick', () => resetPanelWidth());
  resizeHandle.addEventListener('keydown', (event) => {
    if (event.key === 'Home') {
      resetPanelWidth();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = panelWidth ?? defaultPanelWidth();
    applyPanelWidth(current + (event.key === 'ArrowLeft' ? 40 : -40));
  });

  const sendPageContext = () => {
    frame.contentWindow?.postMessage(
      {
        type: 'VARKOLE_PAGE_CONTEXT',
        recordId: recordIdFromSalesforceUrl(location.href),
        pageUrl: location.href,
      },
      new URL(chrome.runtime.getURL('/')).origin,
    );
  };
  frame.addEventListener('load', sendPageContext);
  launcher.addEventListener('click', () => {
    sendPageContext();
    setOpen(true);
  });
  collapse.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen && !componentPickerCleanup) setOpen(false);
  });

  wrapper.append(launcher, collapse, resizeHandle, frame);
  shadow.append(style, wrapper);
  document.documentElement.append(host);
  void chrome.storage.local.get(PANEL_WIDTH_KEY).then((stored) => {
    const saved = stored[PANEL_WIDTH_KEY];
    if (typeof saved === 'number') applyPanelWidth(saved, false);
  });
}

function applyPanelWidth(width: number, persist = true) {
  if (!panelHost || window.innerWidth <= 900) return;
  const maximum = Math.min(MAX_PANEL_WIDTH, window.innerWidth - 48);
  panelWidth = Math.round(Math.max(Math.min(MIN_PANEL_WIDTH, maximum), Math.min(width, maximum)));
  panelHost.style.setProperty('--varkole-drawer-width', `${panelWidth}px`);
  panelWrapper?.querySelector('.resize-handle')?.setAttribute('aria-valuenow', String(panelWidth));
  if (persist) void chrome.storage.local.set({ [PANEL_WIDTH_KEY]: panelWidth });
}

function defaultPanelWidth() {
  return Math.min(
    MAX_PANEL_WIDTH,
    Math.max(MIN_PANEL_WIDTH, window.innerWidth * DEFAULT_PANEL_WIDTH_RATIO),
  );
}

function resetPanelWidth() {
  applyPanelWidth(defaultPanelWidth());
}

function setOpen(open: boolean) {
  if (!panelWrapper) return;
  isOpen = open;
  panelWrapper.classList.toggle('open', open);
}

function startComponentPicker() {
  componentPickerCleanup?.();

  const outline = document.createElement('div');
  outline.id = 'varkole-component-picker-outline';
  Object.assign(outline.style, {
    position: 'fixed',
    zIndex: '2147483645',
    display: 'none',
    pointerEvents: 'none',
    border: '2px solid #12c9f4',
    borderRadius: '6px',
    background: 'rgba(18, 201, 244, 0.08)',
    boxShadow: '0 0 0 3px rgba(18, 201, 244, 0.18)',
  });

  const instruction = document.createElement('div');
  instruction.id = 'varkole-component-picker-instruction';
  instruction.textContent = 'Varkole: click a Salesforce component · Esc to cancel';
  Object.assign(instruction.style, {
    position: 'fixed',
    zIndex: '2147483645',
    top: '14px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '9px 14px',
    border: '1px solid rgba(18, 201, 244, 0.65)',
    borderRadius: '999px',
    color: '#ffffff',
    background: '#071a4a',
    boxShadow: '0 8px 24px rgba(3, 16, 48, 0.28)',
    pointerEvents: 'none',
    font: '700 13px/1.2 system-ui, sans-serif',
  });
  document.documentElement.append(outline, instruction);

  let observer: MutationObserver | undefined;
  let timeout: number | undefined;

  const finish = (result?: ComponentPickResultMessage) => {
    observer?.disconnect();
    if (timeout !== undefined) window.clearTimeout(timeout);
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeydown, true);
    outline.remove();
    instruction.remove();
    componentPickerCleanup = undefined;
    if (result) sendComponentPickResult(result);
  };

  const waitForRenderedComponent = () => {
    instruction.textContent = 'Varkole: waiting for the selected component to render…';
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          const component = findComponentInAddedTree(node);
          if (component) {
            finish({ type: 'VARKOLE_COMPONENT_PICK_RESULT', status: 'found', component });
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timeout = window.setTimeout(() => {
      finish({
        type: 'VARKOLE_COMPONENT_PICK_RESULT',
        status: 'not-found',
        message:
          'No custom LWC or Aura component marker appeared. This may be a standard Salesforce action, Flow, or protected managed component.',
      });
    }, 3_500);
  };

  function handlePointerMove(event: PointerEvent) {
    const element = event
      .composedPath()
      .find((target): target is Element => target instanceof Element);
    if (!element || element === outline || element === instruction) return;
    const rectangle = element.getBoundingClientRect();
    if (!rectangle.width || !rectangle.height) return;
    Object.assign(outline.style, {
      display: 'block',
      left: `${Math.max(0, rectangle.left)}px`,
      top: `${Math.max(0, rectangle.top)}px`,
      width: `${Math.max(0, Math.min(rectangle.width, window.innerWidth - rectangle.left))}px`,
      height: `${Math.max(0, Math.min(rectangle.height, window.innerHeight - rectangle.top))}px`,
    });
  }

  function handleClick(event: MouseEvent) {
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('click', handleClick, true);
    outline.style.display = 'none';
    const component = componentHintFromComposedPath(event.composedPath());
    if (component) {
      finish({ type: 'VARKOLE_COMPONENT_PICK_RESULT', status: 'found', component });
      return;
    }
    // The Salesforce click is intentionally allowed to continue. Quick actions and tabs often
    // create their custom component host only after the click handler completes.
    waitForRenderedComponent();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    finish({
      type: 'VARKOLE_COMPONENT_PICK_RESULT',
      status: 'cancelled',
      message: 'Component selection was cancelled.',
    });
  }

  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeydown, true);
  componentPickerCleanup = () => finish();
}

function findComponentInAddedTree(root: Element): PickedComponentContext | undefined {
  const direct = componentHintFromElement(root);
  if (direct) return direct;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let inspected = 0;
  while (walker.nextNode() && inspected < 800) {
    inspected += 1;
    if (!(walker.currentNode instanceof Element)) continue;
    const hint = componentHintFromElement(walker.currentNode);
    if (hint) return hint;
  }
  return undefined;
}

function sendComponentPickResult(result: ComponentPickResultMessage) {
  panelFrame?.contentWindow?.postMessage(result, new URL(chrome.runtime.getURL('/')).origin);
}

function sendCurrentRecordContext() {
  panelFrame?.contentWindow?.postMessage(
    {
      type: 'VARKOLE_PAGE_CONTEXT',
      recordId: recordIdFromSalesforceUrl(location.href),
      pageUrl: location.href,
    },
    new URL(chrome.runtime.getURL('/')).origin,
  );
}

let lastSalesforceUrl = location.href;
function sendRecordContextWhenUrlChanges() {
  if (location.href === lastSalesforceUrl) return;
  lastSalesforceUrl = location.href;
  sendCurrentRecordContext();
}

window.addEventListener('hashchange', sendRecordContextWhenUrlChanges);
window.addEventListener('popstate', sendRecordContextWhenUrlChanges);
window.addEventListener('resize', () => {
  if (panelWidth && window.innerWidth > 900) applyPanelWidth(panelWidth, false);
});
window.setInterval(sendRecordContextWhenUrlChanges, 750);

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
  if (
    event.source !== panelFrame?.contentWindow ||
    event.origin !== extensionOrigin ||
    !event.data ||
    typeof event.data !== 'object' ||
    (event.data as { type?: unknown }).type !== 'VARKOLE_START_COMPONENT_PICK'
  ) {
    return;
  }
  startComponentPicker();
});

const PANEL_STYLES = `
  :host { all: initial; --varkole-drawer-width: clamp(660px, 54vw, 980px); }
  .launcher {
    all: unset; position: fixed; z-index: 2147483646; right: 14px; top: 52%;
    box-sizing: border-box; width: 34px; height: 34px; display: grid; place-items: center;
    padding: 0; overflow: visible; border: 0; border-radius: 0;
    appearance: none; -webkit-appearance: none; background: transparent !important; box-shadow: none;
    cursor: pointer; transition: transform .18s ease, opacity .18s ease, right .24s ease;
  }
  .launcher:hover { transform: translateY(-2px) scale(1.03); }
  .launcher img {
    display: block; width: 34px; height: 34px; object-fit: contain;
    filter: drop-shadow(0 5px 8px rgba(3,16,48,.28));
  }
  .panel {
    position: fixed; z-index: 2147483647; inset: 0 0 0 auto;
    width: var(--varkole-drawer-width); min-width: 0; height: 100vh;
    overflow: hidden; border: 0; background: #f5f7fb;
    box-shadow: -20px 0 60px rgba(3,16,48,.26);
    transform: translateX(104%); visibility: hidden;
    transition: transform .24s cubic-bezier(.2,.8,.2,1), visibility 0s linear .24s;
  }
  .open .panel {
    transform: translateX(0); visibility: visible;
    transition: transform .24s cubic-bezier(.2,.8,.2,1), visibility 0s;
  }
  .collapse {
    position: fixed; z-index: 2147483647; right: var(--varkole-drawer-width); top: 50%;
    width: 34px; height: 68px; padding: 0;
    border: 1px solid rgba(118,151,196,.45); border-right: 0;
    border-radius: 12px 0 0 12px; color: #dff5ff; background: #071a4a;
    box-shadow: -8px 8px 24px rgba(3,16,48,.22); font: 700 30px/1 system-ui;
    cursor: pointer; opacity: 0; visibility: hidden; pointer-events: none;
    transform: translateY(-50%) translateX(12px);
    transition: transform .2s ease, opacity .2s ease, visibility 0s linear .2s;
  }
  .collapse:hover { color: white; background: #0b347b; }
  .resize-handle {
    position: fixed; z-index: 2147483647; right: calc(var(--varkole-drawer-width) - 7px); top: 0;
    width: 14px; height: 100vh; display: flex; align-items: center; justify-content: center;
    color: #dff5ff; font: 800 18px/1 system-ui; cursor: col-resize; touch-action: none;
    opacity: 0; visibility: hidden; pointer-events: none;
  }
  .resize-handle::after {
    content: ''; position: absolute; z-index: -1; left: 6px; top: 0; width: 2px; height: 100%;
    background: rgba(22,201,244,.7); opacity: 0; transition: opacity .16s ease;
  }
  .resize-handle:hover::after, .resize-handle.dragging::after { opacity: 1; }
  .open .collapse {
    opacity: 1; visibility: visible; pointer-events: auto;
    transform: translateY(-50%) translateX(0);
    transition: transform .2s ease, opacity .2s ease, visibility 0s;
  }
  .open .resize-handle { opacity: 1; visibility: visible; pointer-events: auto; }
  .open .launcher { opacity: 0; pointer-events: none; }
  @media (max-width: 900px) {
    :host { --varkole-drawer-width: 100vw; }
    .panel { width: 100vw; }
    .collapse { right: auto; left: 8px; border-right: 1px solid rgba(118,151,196,.45); border-radius: 10px; }
    .resize-handle { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .panel, .launcher, .collapse { transition: none; } }
`;

chrome.runtime.onMessage.addListener((message: PanelMessage) => {
  if (message.type === 'TOGGLE_VARKOLE_PANEL') {
    initialize();
    if (!isOpen) sendCurrentRecordContext();
    setOpen(!isOpen);
  } else if (message.type === 'OPEN_VARKOLE_PANEL') {
    initialize();
    sendCurrentRecordContext();
    setOpen(true);
  }
});

initialize();
