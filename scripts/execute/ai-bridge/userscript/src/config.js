const DAEMON_PORT_KEY = "ai_bridge_port";
const SELECTORS_KEY = "ai_bridge_selectors";
const DEFAULT_PORT = 58721;

function getPort() {
  return GM_getValue(DAEMON_PORT_KEY, DEFAULT_PORT);
}

function setPort(port) {
  GM_setValue(DAEMON_PORT_KEY, port);
}

function getSelectors() {
  return GM_getValue(SELECTORS_KEY, {});
}

function setSelectors(selectors) {
  GM_setValue(SELECTORS_KEY, selectors);
}
