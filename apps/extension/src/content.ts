import { recordIdFromSalesforceUrl } from './record-context';

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
    if (event.key === 'Escape' && isOpen) setOpen(false);
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
