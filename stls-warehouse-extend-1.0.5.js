// stls-warehouse-extend-1.0.5.js
(function () {
  // -------------- small helpers --------------
  function ready(fn){ document.readyState!=="loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function injectCSSOnce(){
    if (document.getElementById("stls-warehouse-css")) return;
    var css = `
      .stls-warehouse-extra { margin-top:.5em; padding-top:.5em; border-top:1px dashed rgba(0,0,0,.25); font-size:12px; line-height:1.35; color:#222; }
      .stls-warehouse-extra .stls-row { margin:2px 0; display:flex; gap:.4em; }
      .stls-warehouse-extra .stls-label { font-weight:600; white-space:nowrap; }
      .stls-warehouse-extra .stls-muted { opacity:.8; }
      .stls-warehouse-extra hr { display:none; }
      /* Completely suppress any jQuery UI tooltip visibility while we work */
      .stls-hide-tooltips [id^="ui-id-"] { display: none !important; }
      .stls-hide-tooltips [role="tooltip"] { display: none !important; }
    `;
    var el=document.createElement("style");
    el.id="stls-warehouse-css";
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  }

  // -------------- finders --------------
  function findEventTitleNode(evtEl){
    // The bold line containing "(8160) Dry Hire - ..."
    return evtEl.querySelector(".warehouse_event_maincell > div:nth-of-type(1)");
  }

  function extractJobNumberFromTitle(titleNode){
    if (!titleNode) return null;
    // Text example: "(8160) Dry Hire - With Transport"
    var m = titleNode.textContent.match(/\((\d+)\)/);
    return m ? m[1] : null;
  }

  function getTooltipFromAria(evtEl){
    var id = evtEl.getAttribute("aria-describedby");
    if (!id) return null;
    return document.getElementById(id) || null;
  }

  // -------------- don’t show, just ensure tooltip node exists --------------
  async function ensureTooltipNode(evtEl){
    // If the node already exists, use it.
    var tip = getTooltipFromAria(evtEl);
    if (tip) return tip;

    // Otherwise, briefly simulate a hover on a stable child to make the widget create its tooltip,
    // but force tooltips hidden globally so nothing flashes.
    document.documentElement.classList.add("stls-hide-tooltips");

    var target =
      evtEl.querySelector(".warehouse_event_maincell") ||
      evtEl.querySelector(".last_subcell") ||
      evtEl.querySelector(".first_subcell") ||
      evtEl;

    // Synthetic hover with coordinates
    if (target) {
      var rect = target.getBoundingClientRect();
      var x = rect.left + Math.min(Math.max(5, rect.width/2), rect.width-5);
      var y = rect.top  + Math.min(Math.max(5, rect.height/2), rect.height-5);
      var opts = { bubbles:true, cancelable:true, clientX:x, clientY:y, view:window };
      try { target.dispatchEvent(new PointerEvent("pointerenter", opts)); } catch(e){}
      try { target.dispatchEvent(new MouseEvent("mouseover",  opts)); } catch(e){}
      try { target.dispatchEvent(new MouseEvent("mouseenter", opts)); } catch(e){}
      try { target.dispatchEvent(new MouseEvent("mousemove",  opts)); } catch(e){}
    }

    // Wait a short time for aria-describedby to be added & the tooltip div to be created
    for (let i=0;i<20;i++){ // up to ~2s
      tip = getTooltipFromAria(evtEl);
      if (tip) break;
      await sleep(100);
    }

    // End hover so no state gets stuck (still hidden by CSS anyway)
    if (target) {
      try { target.dispatchEvent(new MouseEvent("mouseleave", { bubbles:true, cancelable:true, view:window })); } catch(e){}
      try { target.dispatchEvent(new PointerEvent("pointerleave", { bubbles:true, cancelable:true, view:window })); } catch(e){}
    }

    // Drop the suppression so normal hover behaviour returns
    document.documentElement.classList.remove("stls-hide-tooltips");

    // Ensure any created tooltip node is hidden (belt & braces)
    if (tip && tip.style) tip.style.display = "none";

    return tip || null;
  }

  // -------------- build info block from tooltip HTML --------------
  function buildInfoBlockFromTooltipNode(tipNode, jobNumberFromTitle){
    // If no tooltip node, return null (caller will render a fallback line)
    if (!tipNode) return null;

    // Clone the content safely without altering / showing the original
    var rawHTML = tipNode.innerHTML || "";
    if (!rawHTML.trim()) return null;

    var wrap = document.createElement("div");
    wrap.innerHTML = rawHTML;

    // jQuery UI often duplicates content (hidden/visible copies). Take the deepest visible-ish content if present.
    var contentCandidate = wrap;
    var children = wrap.children;
    if (children && children.length > 0) {
      // Prefer the last child block (newest); if two copies exist, one is often display:none in the original DOM,
      // but here both will be visible in our detached fragment. We’ll just parse lines from both.
      contentCandidate = wrap;
    }

    // Parse "Label : Value" lines into rows
    var rows = [];
    contentCandidate.querySelectorAll("div").forEach(function(div){
      var t = (div.textContent || "").replace(/\s+/g," ").trim();
      if (!t) return;
      var idx = t.indexOf(" : ");
      if (idx > -1) rows.push({ label: t.slice(0, idx).trim(), value: t.slice(idx+3).trim() });
      else          rows.push({ label:"", value:t, muted:true });
    });

    // If the tooltip didn’t include "Job number", we’ll add it from the title parse
    if (jobNumberFromTitle && !rows.some(r => r.label === "Job number")) {
      rows.unshift({ label: "Job number", value: jobNumberFromTitle });
    }

    var order = [
      "Job number","Outgoing","Job Start","Job Finish","Return By",
      "Customer/company name","Manager","Goods in","Status","Job type",
      "Collect from","Full Collection Address"
    ];

    var box = document.createElement("div");
    box.className = "stls-warehouse-extra";

    var keyOf = r => (r.label||"") + "|" + (r.value||"");
    var remaining = new Map(rows.map(r => [keyOf(r), r]));

    function addRow(r){
      var line = document.createElement("div");
      line.className = "stls-row" + (r.muted ? " stls-muted" : "");
      if (r.label) {
        var lab = document.createElement("span"); lab.className="stls-label"; lab.textContent = r.label + ":"; line.appendChild(lab);
      }
      var val = document.createElement("span"); val.textContent = r.value || ""; line.appendChild(val);
      box.appendChild(line);
    }

    order.forEach(function(lbl){
      var r = rows.find(x => x.label === lbl);
      if (r && remaining.has(keyOf(r))) { addRow(r); remaining.delete(keyOf(r)); }
    });
    rows.forEach(function(r){
      var k = keyOf(r);
      if (remaining.has(k)) { addRow(r); remaining.delete(k); }
    });

    return box;
  }

  // -------------- per-event processing (sequential) --------------
  async function processEvent(evtEl){
    if (evtEl.dataset.stlsProcessed) return;
    evtEl.dataset.stlsProcessed = "1";

    var container = evtEl.querySelector(".warehouse_event_maincell") || evtEl;

    // If we ever re-run (e.g., via MutationObserver), tidy old block
    var old = container.querySelector(".stls-warehouse-extra");
    if (old) old.remove();

    // Extract job number from the title line
    var titleNode = findEventTitleNode(evtEl);
    var jobNo = extractJobNumberFromTitle(titleNode);

    // Make sure the event has a tooltip node (without showing it)
    var tipNode = getTooltipFromAria(evtEl) || await ensureTooltipNode(evtEl);

    // Build the inline info block
    var block = buildInfoBlockFromTooltipNode(tipNode, jobNo);

    if (block) container.appendChild(block);
    else {
      var fb=document.createElement("div");
      fb.className="stls-warehouse-extra";
      fb.textContent="(No extra info available)";
      container.appendChild(fb);
    }
  }

  async function processAllSequential(){
    injectCSSOnce();
    var list = Array.from(document.querySelectorAll(".warehouse_event"));
    for (const evt of list) {
      await processEvent(evt);
      await sleep(60); // let UI settle between items
    }
  }

  function watchForNewSequential(){
    var queue = [];
    var running = false;

    async function runQueue(){
      if (running) return;
      running = true;
      while (queue.length) {
        var evt = queue.shift();
        if (!document.body.contains(evt) || evt.dataset.stlsProcessed) continue;
        await processEvent(evt);
        await sleep(60);
      }
      running = false;
    }

    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.from(m.addedNodes||[]).forEach(function(n){
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(".warehouse_event")) queue.push(n);
          else if (n.querySelectorAll) n.querySelectorAll(".warehouse_event").forEach(function(e){ queue.push(e); });
        });
      });
      if (queue.length) runQueue();
    });
    obs.observe(document.body, { childList:true, subtree:true });
  }

  // -------------- start --------------
  ready(function(){
    let tries=0, t=setInterval(function(){
      tries++;
      if (document.querySelector(".warehouse_event")) {
        clearInterval(t);
        processAllSequential().then(watchForNewSequential);
      }
      if (tries>150) clearInterval(t);
    }, 100);
  });
})();
