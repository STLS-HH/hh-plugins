// stls-warehouse-extend-1.0.3.js
(function () {
  // ---------- tiny helpers ----------
  function ready(fn){ document.readyState!=="loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }

  function injectCSS(){
    if (document.getElementById("stls-warehouse-css")) return;
    var css = `
      .stls-warehouse-extra { margin-top:.5em; padding-top:.5em; border-top:1px dashed rgba(0,0,0,.25); font-size:12px; line-height:1.35; color:#222; }
      .stls-warehouse-extra .stls-row { margin:2px 0; display:flex; gap:.4em; }
      .stls-warehouse-extra .stls-label { font-weight:600; white-space:nowrap; }
      .stls-warehouse-extra .stls-muted { opacity:.8; }
      .stls-warehouse-extra hr { display:none; }
    `;
    var el=document.createElement("style");
    el.id="stls-warehouse-css";
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  }

  // Shared live region (where the hover tooltip renders content)
  function getLiveRegion(){
    return document.querySelector('[role="log"].ui-helper-hidden-accessible');
  }

  // Hard-hide any currently visible tooltip blocks (so nothing stays stuck visible)
  function cleanupVisibleTooltips(){
    var lr = getLiveRegion();
    if (!lr) return;
    Array.from(lr.children).forEach(function(n){
      if (n && n.nodeType === 1 && n.style && n.style.display !== "none") {
        n.style.display = "none";
      }
    });
  }

  // Mouse / pointer event helpers
  function hoverOn(el){
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var x = rect.left + Math.max(5, Math.min(rect.width-5, rect.width/2));
    var y = rect.top  + Math.max(5, Math.min(rect.height-5, rect.height/2));
    var opts = {bubbles:true,cancelable:true,clientX:x,clientY:y,view:window};
    try { el.dispatchEvent(new PointerEvent("pointerenter", opts)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent("mouseover",  opts)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent("mouseenter", opts)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent("mousemove",  opts)); } catch(e){}
  }
  function hoverOff(el){
    if (!el) return;
    try { el.dispatchEvent(new MouseEvent("mouseleave", {bubbles:true,cancelable:true,view:window})); } catch(e){}
    try { el.dispatchEvent(new PointerEvent("pointerleave", {bubbles:true,cancelable:true,view:window})); } catch(e){}
  }

  // Fetch tooltip HTML for one event (sequential-safe)
  function fetchTooltipHTML(evtEl){
    return new Promise(function(resolve){
      var lr = getLiveRegion();
      var before = lr ? lr.children.length : 0;

      var targets = [
        evtEl.querySelector(".warehouse_event_maincell"),
        evtEl.querySelector(".last_subcell"),
        evtEl.querySelector(".first_subcell"),
        evtEl
      ].filter(Boolean);

      // Start hover on the first valid target (don’t spam all at once)
      var target = targets[0] || evtEl;
      hoverOn(target);

      // Poll for new/visible content (up to ~2.5s)
      var tries = 0, max = 25;
      var timer = setInterval(function(){
        tries++;
        var lrNow = getLiveRegion();
        var html = "";
        if (lrNow && lrNow.children.length > before) {
          // newest children first; prefer the visible one if any
          var candidates = Array.from(lrNow.children).reverse();
          var block = candidates.find(n => n.nodeType===1 && (!n.style || n.style.display !== "none")) || candidates[0];
          html = block ? block.innerHTML : "";
        }
        if (html && html.trim()) {
          hoverOff(target);
          clearInterval(timer);
          // hide any visible tooltip the hover created
          cleanupVisibleTooltips();
          resolve(html);
        } else if (tries >= max) {
          hoverOff(target);
          clearInterval(timer);
          cleanupVisibleTooltips();
          resolve("");
        }
      }, 100);
    });
  }

  // Convert tooltip HTML to a neat inline block
  function buildInfoBlock(rawHTML){
    if (!rawHTML) return null;

    var wrap = document.createElement("div");
    wrap.innerHTML = rawHTML;

    var rows = [];
    wrap.querySelectorAll("div").forEach(function(div){
      var t = (div.textContent || "").replace(/\s+/g," ").trim();
      if (!t) return;
      var idx = t.indexOf(" : ");
      if (idx > -1) {
        rows.push({ label: t.slice(0, idx).trim(), value: t.slice(idx+3).trim() });
      } else {
        rows.push({ label:"", value:t, muted:true });
      }
    });

    var order = [
      "Job number","Outgoing","Job Start","Job Finish","Return By",
      "Customer/company name","Manager","Goods in","Status","Job type",
      "Collect from","Full Collection Address"
    ];

    var box = document.createElement("div");
    box.className = "stls-warehouse-extra";

    var keyOf = r => (r.label||"") + "|" + (r.value||"");
    var remaining = new Map(rows.map(r => [keyOf(r), r]));

    function appendRow(r){
      var line = document.createElement("div");
      line.className = "stls-row" + (r.muted ? " stls-muted" : "");
      if (r.label) {
        var lab = document.createElement("span");
        lab.className="stls-label";
        lab.textContent = r.label + ":";
        line.appendChild(lab);
      }
      var val = document.createElement("span");
      val.textContent = r.value || "";
      line.appendChild(val);
      box.appendChild(line);
    }

    order.forEach(function(lbl){
      var r = rows.find(x => x.label === lbl);
      if (r && remaining.has(keyOf(r))) { appendRow(r); remaining.delete(keyOf(r)); }
    });
    rows.forEach(function(r){
      var k = keyOf(r);
      if (remaining.has(k)) { appendRow(r); remaining.delete(k); }
    });

    return box;
  }

  // Process ONE event (called in sequence)
  async function processEventSequential(evtEl){
    if (evtEl.dataset.stlsProcessed) return;
    evtEl.dataset.stlsProcessed = "1";
    var container = evtEl.querySelector(".warehouse_event_maincell") || evtEl;

    try {
      var html = await fetchTooltipHTML(evtEl);
      var block = buildInfoBlock(html);
      if (block) {
        container.appendChild(block);
      } else {
        var fb = document.createElement("div");
        fb.className = "stls-warehouse-extra";
        fb.textContent = "(No extra info available)";
        container.appendChild(fb);
      }
    } catch (e) {
      console.warn("[STLS] warehouse extra failed", e);
    }
  }

  // Run through all current events sequentially
  async function processAllSequential(){
    injectCSS();
    var list = Array.from(document.querySelectorAll(".warehouse_event"));
    for (const evt of list) {
      // small gap between events to let UI settle
      // eslint-disable-next-line no-await-in-loop
      await processEventSequential(evt);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 60));
    }
  }

  // Watch for new events and queue them
  function watchForNewSequential(){
    var queue = [];
    var running = false;

    async function runQueue(){
      if (running) return;
      running = true;
      while (queue.length) {
        var evt = queue.shift();
        // Skip if removed or already processed
        if (!document.body.contains(evt) || evt.dataset.stlsProcessed) continue;
        // eslint-disable-next-line no-await-in-loop
        await processEventSequential(evt);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 60));
      }
      running = false;
    }

    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.from(m.addedNodes || []).forEach(function(n){
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(".warehouse_event")) { queue.push(n); }
          else if (n.querySelectorAll) n.querySelectorAll(".warehouse_event").forEach(function(e){ queue.push(e); });
        });
      });
      if (queue.length) runQueue();
    });
    obs.observe(document.body, { childList:true, subtree:true });
  }

  // ---------- start ----------
  ready(function(){
    let tries=0, t=setInterval(function(){
      tries++;
      if (document.querySelector(".warehouse_event")) {
        clearInterval(t);
        processAllSequential().then(watchForNewSequential);
      }
      if (tries>120) clearInterval(t);
    }, 100);
  });
})();
