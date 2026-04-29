export function applyInitialUIState({ query, config, document }) {
  const hasSidebar = Object.hasOwn(query, "sidebar");
  const hasOutline = Object.hasOwn(query, "outline");

  let sidebarOpen = hasSidebar
    ? query.sidebar === "1"
    : Boolean(config.default_sidebar_open);
  let outlineOpen = hasOutline
    ? query.outline === "1"
    : Boolean(config.default_outline_open);

  return {
    viewMode: "preview",
    sidebarOpen,
    outlineOpen,
  };
}

export function getAppMode(bootstrap) {
  if (bootstrap?.mode === "public-share") {
    return "public-share";
  }
  return "admin";
}

export function getLayoutContext() {
  return "preview-only";
}

export function getShareButtonState({ status, disabledReason, error = "" }) {
  if (status === "starting") {
    return { label: "Starting...", disabled: true, error: "" };
  }
  if (status === "active") {
    return { label: "Stop sharing", disabled: false, error: "" };
  }
  if (status === "error") {
    return {
      label: "Share",
      disabled: Boolean(disabledReason),
      error,
    };
  }
  return {
    label: "Share",
    disabled: Boolean(disabledReason),
    error: "",
  };
}

export function createEmptyScrollSnapshots() {
  return {
    "preview-only": null,
  };
}

export function saveScrollSnapshot(snapshots, context, metrics) {
  snapshots[context] = {
    pageY: clamp(metrics.pageY, 0, metrics.pageMax),
    pageRatio: ratio(metrics.pageY, metrics.pageMax),
  };
}

export function restoreScrollTargets({
  fromContext,
  toContext,
  snapshots,
  current,
}) {
  const exact = snapshots[toContext];
  if (exact) {
    return {
      pageY: clamp(exact.pageY, 0, current.pageMax),
    };
  }

  const previous = snapshots[fromContext];
  if (!previous) {
    return { pageY: 0 };
  }

  return {
    pageY: Math.round(previous.pageRatio * current.pageMax),
  };
}

export function getMobilePanelState({
  isMobile,
  filesAvailable,
  toggle,
  current,
}) {
  if (!isMobile) {
    return current;
  }

  if (toggle === "sidebar") {
    const nextSidebarOpen = filesAvailable ? !current.sidebarOpen : false;
    return {
      sidebarOpen: nextSidebarOpen,
      outlineOpen: nextSidebarOpen ? false : current.outlineOpen,
    };
  }

  if (toggle === "outline") {
    const nextOutlineOpen = !current.outlineOpen;
    return {
      sidebarOpen: nextOutlineOpen ? false : current.sidebarOpen,
      outlineOpen: nextOutlineOpen,
    };
  }

  return {
    sidebarOpen: current.sidebarOpen,
    outlineOpen: current.outlineOpen,
  };
}

function ratio(value, max) {
  if (max <= 0) return 0;
  return clamp(value, 0, max) / max;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
