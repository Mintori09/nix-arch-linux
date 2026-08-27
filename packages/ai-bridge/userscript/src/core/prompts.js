function createPromptTemplatesPanel(adapter) {
  let promptsList = [];
  let checkedNames = [];
  let containerEl = null;
  let listEl = null;

  function getDaemonUrl() {
    return `http://127.0.0.1:${getPort()}`;
  }

  async function fetchPromptsList() {
    try {
      const res = await gmFetch(`${getDaemonUrl()}/prompts`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async function fetchPromptContent(name) {
    try {
      const res = await gmFetch(
        `${getDaemonUrl()}/prompts/${encodeURIComponent(name)}`,
      );
      if (!res.ok) return "";
      const data = await res.json();
      return data.content || "";
    } catch {
      return "";
    }
  }

  async function init() {
    checkedNames = getDefaultPrompts();
    promptsList = await fetchPromptsList();
    buildDOM();
    await autoFill();
  }

  function buildDOM() {
    containerEl = document.createElement("div");
    containerEl.id = "ai-bridge-prompts-section";
    containerEl.style.cssText =
      "border-bottom:1px solid #ccc;padding:8px;margin-bottom:8px;";

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;";

    const isCollapsed =
      typeof GM_getValue !== "undefined"
        ? GM_getValue("ai_bridge_prompts_collapsed", false)
        : false;

    const titleContainer = document.createElement("div");
    titleContainer.style.cssText =
      "display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;";

    const toggleIcon = document.createElement("span");
    toggleIcon.textContent = isCollapsed ? "▸" : "▾";
    toggleIcon.style.cssText = "font-size:10px;width:12px;";

    const title = document.createElement("span");
    title.textContent = "Prompt Templates";
    title.style.cssText = "font-weight:bold;font-size:12px;";

    titleContainer.appendChild(toggleIcon);
    titleContainer.appendChild(title);

    const settingsBtn = document.createElement("button");
    settingsBtn.textContent = "\u2699";
    settingsBtn.style.cssText =
      "cursor:pointer;background:none;border:none;font-size:14px;";
    settingsBtn.title = "Configure default prompts";
    settingsBtn.addEventListener("click", showDefaultsConfig);

    header.appendChild(titleContainer);
    header.appendChild(settingsBtn);
    containerEl.appendChild(header);

    listEl = document.createElement("div");
    listEl.id = "ai-bridge-prompts-list";
    listEl.style.display = isCollapsed ? "none" : "block";
    containerEl.appendChild(listEl);

    titleContainer.addEventListener("click", () => {
      const currentlyCollapsed = listEl.style.display === "none";
      const nextCollapsed = !currentlyCollapsed;
      listEl.style.display = nextCollapsed ? "none" : "block";
      toggleIcon.textContent = nextCollapsed ? "▸" : "▾";
      if (typeof GM_setValue !== "undefined") {
        GM_setValue("ai_bridge_prompts_collapsed", nextCollapsed);
      }
    });

    renderCheckboxes();
  }

  function renderCheckboxes() {
    listEl.textContent = "";
    if (promptsList.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No prompt templates found.";
      empty.style.cssText = "color:#999;font-size:11px;text-align:center;";
      listEl.appendChild(empty);
      return;
    }

    promptsList.forEach((prompt) => {
      const label = document.createElement("label");
      label.style.cssText =
        "display:flex;align-items:center;gap:4px;padding:3px 0;cursor:pointer;font-size:12px;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = checkedNames.includes(prompt.name);
      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) {
          checkedNames.push(prompt.name);
        } else {
          checkedNames = checkedNames.filter((n) => n !== prompt.name);
        }
        await autoFill();
      });

      const text = document.createElement("span");
      text.textContent = prompt.title;

      label.appendChild(checkbox);
      label.appendChild(text);
      listEl.appendChild(label);
    });
  }

  function showDefaultsConfig() {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;";

    const modal = document.createElement("div");
    modal.style.cssText =
      "background:#fff;border-radius:8px;padding:16px;min-width:300px;max-height:80vh;overflow-y:auto;";

    const title = document.createElement("h3");
    title.textContent = "Default Prompts";
    title.style.cssText = "margin:0 0 12px;font-size:14px;color:#333;";

    const desc = document.createElement("p");
    desc.textContent = "Select prompts that auto-fill on page load:";
    desc.style.cssText = "margin:0 0 8px;font-size:12px;color:#666;";

    const list = document.createElement("div");
    const tempChecked = [...checkedNames];

    promptsList.forEach((prompt) => {
      const label = document.createElement("label");
      label.style.cssText =
        "display:flex;align-items:center;gap:4px;padding:4px 0;cursor:pointer;font-size:13px;";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = tempChecked.includes(prompt.name);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          tempChecked.push(prompt.name);
        } else {
          const idx = tempChecked.indexOf(prompt.name);
          if (idx >= 0) tempChecked.splice(idx, 1);
        }
      });

      const text = document.createElement("span");
      text.textContent = prompt.title;

      label.appendChild(cb);
      label.appendChild(text);
      list.appendChild(label);
    });

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:12px;";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.cssText =
      "padding:6px 16px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;";
    saveBtn.addEventListener("click", () => {
      setDefaultPrompts(tempChecked);
      checkedNames = [...tempChecked];
      renderCheckboxes();
      autoFill();
      overlay.remove();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "padding:6px 16px;background:#eee;color:#333;border:none;border-radius:4px;cursor:pointer;";
    cancelBtn.addEventListener("click", () => overlay.remove());

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(list);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  function combineTemplates(inputText, templateContents) {
    return templateContents
      .map((tmpl) => {
        if (tmpl.includes("{{content}}")) {
          return tmpl.replace(/\{\{content\}\}/g, inputText);
        }
        return tmpl + "\n" + inputText;
      })
      .join("\n\n---\n\n");
  }

  async function autoFill() {
    const checkedPrompts = promptsList.filter((p) =>
      checkedNames.includes(p.name),
    );
    if (checkedPrompts.length === 0) return;

    const contents = await Promise.all(
      checkedPrompts.map((p) => fetchPromptContent(p.name)),
    );

    // Get current input text
    const inputEl = adapter.findInput();
    const currentText = inputEl ? inputEl.textContent || "" : "";

    const combined = combineTemplates(currentText, contents.filter(Boolean));
    if (combined) {
      adapter.fillInput(combined);
    }
  }

  function getState() {
    return { checkedNames, promptsList };
  }

  function getContainerEl() {
    return containerEl;
  }

  function getPromptList() {
    return promptsList;
  }

  return {
    init,
    getState,
    getContainerEl,
    getPromptList,
    autoFill,
    fetchPromptsList,
    fetchPromptContent,
  };
}
