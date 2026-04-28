function isMermaidPreBlock(pre) {
  const code = pre?.querySelector("code");
  if (!code) {
    return false;
  }

  const className = code.className || "";
  return (
    className.includes("language-mermaid") ||
    className.includes("lang-mermaid") ||
    pre.classList.contains("mermaid")
  );
}

export function collectPreviewCodeBlocks(previewElement) {
  const result = {
    copyable: [],
    mermaid: [],
  };

  for (const pre of previewElement?.querySelectorAll("pre") || []) {
    const code = pre.querySelector("code");
    if (!code) {
      continue;
    }

    const entry = { pre, code };
    result.copyable.push(entry);

    if (isMermaidPreBlock(pre)) {
      result.mermaid.push(entry);
    }
  }

  return result;
}

export function previewNeedsMermaid(previewElement) {
  return collectPreviewCodeBlocks(previewElement).mermaid.length > 0;
}
