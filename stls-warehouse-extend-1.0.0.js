// stls-warehouse-extend-1.0.0.js
(function () {
  // --- small helper: run when DOM is ready
  function ready(fn){ document.readyState!=="loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }

  // --- insert a tiny stylesheet for the extra block
  function injectCSS(){
    if (document.getElementById("stls-warehouse-css")) return;
    var css = `
      .stls-warehouse-extra { margin-top: .5em; padding-top: .5em; border-top: 1px dashed rgba(0,0,0,.2); font-size: 12px; line-height: 1.35; color: #333; }
      .stls-warehouse-extra .stls-row { margin: 2px 0; display: flex; gap: .4em; }
      .stls-warehouse-extra .stls-label { font-weight: 600; white-space: nowrap; }
      .stls-warehouse-extra .stls-muted { opacity: .8; }
      .stls-warehouse-extra hr { display:none; }
    `;
    var el = document.createElement("style");
    el.id = "stls-warehouse-css";
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  }

  // --- Try to fetch the tooltip HTML for a given event by firing mouseenter briefly
  function fetchTooltipHTML(evtEl){
    return new Promise(function(resolve){
      // fire mouseenter to make HireHop build the tooltip content
      var over = new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window });
      evtEl.dispatchEvent(over);

      // Give the UI a tick to populate its live region / tooltip
      setTimeout(function(){
        // Typical jQuery UI live region used in HireHop tooltips for accessibility
        var liveRegion = document.querySelector('[role="log"].ui-helper-hidden-accessible');
        var html = "";
        if (liveRegion) {
          // Take the last content block within the live region (most recent)
          var blocks = liveRegion.querySelectorAll(":scope > div");
          if (blocks.length) {
            html = blocks[blocks.length - 1].innerHTML || "";
          }
        }
        // fire mouseleave to tidy up
        var out = new MouseEvent("mouseleave", { bubbles: true, cancelable: true, view: window });
        evtEl.dispatchEvent(out);
        resolve(html);
      }, 120); // 120ms is usually enough; adjust if needed
    });
  }

  // --- Convert the tooltip HTML into a clean, compact block
  function buildInfoBlock(rawHTML){
    if (!rawHTML) return null;

    // Make a sandbox to parse the snippet
    var wrap = document.createElement("div");
    wrap.innerHTML = rawHTML;

    // Replace simple lines like "Label : Value" with structured rows
    var rows = [];
    wrap.querySelectorAll("div").forEach(function(div){
      var t = div.textContent.trim();
      if (!t) return;
      // split only on the first " : "
      var idx = t.indexOf(" : ");
      if (idx > -1) {
        var label = t.slice(0, idx).trim();
        var value = t.slice(idx + 3).trim();
        rows.push({ label: label, value: value });
      } else {
        // e.g. headings like "Job number : 15057" already handled; date lines too
        // If it doesn't match, still show it (muted)
        rows.push({ label: "", value: t, muted: true });
      }
    });

    // Build final block
    var box = document.createElement("div");
    box.className = "stls-warehouse-extra";

    // Re-order / group a few important lines if present
    var order = [
      "Job number",
      "Outgoing",
      "Job Start",
      "Job Finish",
      "Return By",
      "Customer/company name",
      "Manager",
      "Goods in",
      "Status",
      "Job type",
      "Collect from",
      "Full Collection Address"
    ];
    // Map for quick lookup
    var map = new Map(rows.map(r => [r.label, r]));
    // Add ordered known rows first
    order.forEach(function(key){
      var r = map.get(key);
      if (r) {
        var line = document.createElement("div");
        line.className = "stls-row";
        if (r.label) {
          var lab = document.createElement("span");
          lab.className = "stls-label";
          lab.textContent = r.label + ":";
          line.appendChild(lab);
        }
        var val = document.createElement("span");
        val.textContent = r.value || "";
        line.appendChild(val);
        box.appendChild(line);
        map.delete(key);
      }
    });
    // Append any remaining rows (muted/uncategorised)
    rows.forEach(function(r){
      if (r.label && map.has(r.label) || (!r.label && r.value)) {
        var line = document.createElement("div");
        line.className = "stls-row" + (r.muted ? " stls-muted" : "");
        if (r.label) {
          var lab = document.createElement("span");
          lab.className = "stls-label";
          lab.textContent = r.label + ":";
          line.appendChild(lab);
        }
        var val = document.createElement("span");
        val.textContent = r.value || "";
        line.appendChild(val);
        box.appendChild(line);
        if (r.label) map.delete(r.label);
      }
    });

    return box;
  }

  // --- Process a single warehouse_event element
  async function processEvent(evtEl){
    if (evtEl.dataset.stlsProcessed) return;
    evtEl.dataset.stlsProcessed = "1";

    // Where to insert? Use the main cell if present; else inside the event root
    var container = evtEl.querySelector(".warehouse_event_maincell") || evtEl;

    try {
      var html = await fetchTooltipHTML(evtEl);
      var block = buildInfoBlock(html);
      if (block) {
        container.appendChild(block);
      } else {
        // Fallback marker so you can see it ran
        var fb = document.createElement("div");
        fb.className = "stls-warehouse-extra";
        fb.textContent = "(No extra info available)";
        container.appendChild(fb);
      }
    } catch (e) {
      console.warn("[STLS] warehouse extra failed", e);
    }
  }

  // --- Find and process all events currently on the page
  function processAll(){
    injectCSS();
    document.querySelectorAll(".warehouse_event").forEach(processEvent);
  }

  // --- Observe for new events being added (e.g., filters, paging)
  function watchForNew(){
    var obs = new MutationObserver(function(muts){
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach(function(n){
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(".warehouse_event")) {
            processEvent(n);
          } else {
            // look inside containers for events
            var found = n.querySelectorAll ? n.querySelectorAll(".warehouse_event") : [];
            found && found.forEach(processEvent);
          }
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // --- Kick off on ready; also retry for a few seconds in case the grid loads late
  ready(function(){
    let tries = 0, t = setInterval(function(){
      tries++;
      if (document.querySelector(".warehouse_event")) {
        clearInterval(t);
        processAll();
        watchForNew();
      }
      if (tries > 80) clearInterval(t); // ~8s safety cutoff
    }, 100);
  });
})();
