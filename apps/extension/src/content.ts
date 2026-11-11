import { recordIdFromSalesforceUrl } from './record-context';

const HOST_ID = 'varkole-cloud-code-guru-root';

type PanelMessage = { type: 'TOGGLE_VARKOLE_PANEL' | 'OPEN_VARKOLE_PANEL' };

let panelWrapper: HTMLDivElement | undefined;
let panelFrame: HTMLIFrameElement | undefined;
let isOpen = false;

function initialize() {
  if (panelWrapper || document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
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

  const sendRecordContext = () => {
    frame.contentWindow?.postMessage(
      { type: 'VARKOLE_RECORD_CONTEXT', recordId: recordIdFromSalesforceUrl(location.href) },
      new URL(chrome.runtime.getURL('/')).origin,
    );
  };
  frame.addEventListener('load', sendRecordContext);
  launcher.addEventListener('click', () => {
    sendRecordContext();
    setOpen(true);
  });
  collapse.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) setOpen(false);
  });

  wrapper.append(launcher, collapse, frame);
  shadow.append(style, wrapper);
  document.documentElement.append(host);
}

function setOpen(open: boolean) {
  if (!panelWrapper) return;
  isOpen = open;
  panelWrapper.classList.toggle('open', open);
}

function sendCurrentRecordContext() {
  panelFrame?.contentWindow?.postMessage(
    { type: 'VARKOLE_RECORD_CONTEXT', recordId: recordIdFromSalesforceUrl(location.href) },
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
  .open .collapse {
    opacity: 1; visibility: visible; pointer-events: auto;
    transform: translateY(-50%) translateX(0);
    transition: transform .2s ease, opacity .2s ease, visibility 0s;
  }
  .open .launcher { opacity: 0; pointer-events: none; }
  @media (max-width: 900px) {
    :host { --varkole-drawer-width: 100vw; }
    .collapse { right: auto; left: 8px; border-right: 1px solid rgba(118,151,196,.45); border-radius: 10px; }
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
