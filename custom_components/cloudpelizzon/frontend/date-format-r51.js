/* CLOUDPELIZZON_GLOBAL_DATE_R51 */
(() => {
  if (window.__cloudPelizzonDateR51) return;
  window.__cloudPelizzonDateR51 = true;

  const formatText = input => {
    let value = String(input ?? "");

    value = value.replace(
      /\b(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?\b/g,
      (_, y, m, d, hh, mm, ss) => `${d}-${m}-${y} ${hh}:${mm}${ss ? `:${ss}` : ""}`
    );

    value = value.replace(
      /\b(20\d{2})-(\d{2})-(\d{2})\b/g,
      (_, y, m, d) => `${d}-${m}-${y}`
    );

    value = value.replace(
      /\b(\d{2})\/(\d{2})\/(20\d{2})\b/g,
      (_, d, m, y) => `${d}-${m}-${y}`
    );

    return value;
  };

  const blocked = el => {
    if (!el || el.nodeType !== 1) return false;
    return ["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(el.tagName)
      || el.isContentEditable;
  };

  const convertNode = node => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (blocked(node.parentElement)) return;
    const before = node.nodeValue || "";
    const after = formatText(before);
    if (after !== before) node.nodeValue = after;
  };

  const observers = new WeakMap();

  const processRoot = root => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) convertNode(node);
    root.querySelectorAll?.("*").forEach(el => {
      if (el.shadowRoot) installRoot(el.shadowRoot);
    });
  };

  const installRoot = root => {
    if (!root || observers.has(root)) return;
    processRoot(root);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          convertNode(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) convertNode(node);
          else if (node.nodeType === Node.ELEMENT_NODE) processRoot(node);
        }
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    observers.set(root, observer);
  };

  const isCloudPelizzonHost = host => {
    const tag = String(host?.tagName || "").toLowerCase();
    return tag.includes("cloudpelizzon") || tag.includes("casa-pelizzon") || tag.includes("pelizzon-energy");
  };

  const originalAttachShadow = Element.prototype.attachShadow;
  if (!Element.prototype.__cloudPelizzonAttachShadowR51) {
    Element.prototype.attachShadow = function(init) {
      const root = originalAttachShadow.call(this, init);
      if (isCloudPelizzonHost(this)) queueMicrotask(() => installRoot(root));
      return root;
    };
    Element.prototype.__cloudPelizzonAttachShadowR51 = true;
  }

  const scan = () => {
    document.querySelectorAll("*").forEach(el => {
      if (isCloudPelizzonHost(el)) installRoot(el.shadowRoot || el);
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  window.CloudPelizzonFormatDateText = formatText;
})();
