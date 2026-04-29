const APP_NAME = "mdview";

export function formatPageTitle(label) {
  const value = String(label || "").trim();
  if (!value) {
    return APP_NAME;
  }
  return `${value} - ${APP_NAME}`;
}

export function formatDocumentTitle(name) {
  return formatPageTitle(name);
}

export function syncPageTitle(targetDocument, label) {
  targetDocument.title = formatPageTitle(label);
}
