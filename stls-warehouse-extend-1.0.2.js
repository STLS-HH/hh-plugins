// stls-warehouse-extend-1.0.2.js
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

  function fire(el, type, opts){
    try { el.dispatchEvent(new (window[type] || MouseEvent)(type, Object.assign({bubbles:true,cancelable:true,view:window}, opts||{}))); } catch(e){}
  }

  // ---------- STRONG hover-scrape of tooltip ----------
  // We simulate a real pointer hover on likely child nodes, then poll the live region for the latest visible block
  function fetchTooltipHTML(evtEl){
    return new Promise(function(resolve){
      var liveRegion = null;
      function getLive(){
        if (!liveRegion) liveRegion = document.querySelector('[role="log"].ui-helper-hidden-accessible');
        return liveRegion;
      }

      // Most likely hover targets (order matters)
      var targets = [
        evtEl.querySelector(".warehouse_event_maincell"),
        evtEl.querySelector(".last_subcell"),
        evtEl.querySelector(".first_subcell"),
        evtEl // fallback to root
      ].filter(Boolean);

      var lr = getLive();
      var beforeCount = lr ? lr.children.length : 0;

      // simulate realistic hover with coordinates
      function hover(el){
        var rect = el.getBoundingClientRect();
        var x = rect.left + Math.max(5, Math.min(rect.width-5, rect.width/2));
        var y = rect.top  + Math.max(5, Math.min(rect.height-5, rect.height/2));
        var opts = {bubbles:true,cancelable:true,clientX:x,clientY:y,view:window};
        try { el.dispatchEvent(new PointerEvent("pointerenter", opts)); } catch(e){}
        try { el.dispatchEvent(new MouseEvent("mouseover",  opts)); } catch(e){}
        try { el.dispatchEvent(new MouseEvent("mouseenter", opts)); } catch(e){}
        try { el.dispatchEvent(new MouseEvent("mousemove",  opts)); } catch(e){}
      }
      targets.forEach(hover);

      // poll up to ~2.5s for fresh content
      var tries = 0, max = 25, timer = setInterval(function(){
        tries++;
        var lrNow = getLive();
        var html = "";

        if (lrNow && lrNow.children.length > beforeCount) {
          // newest children first; prefer the visible one if there are hidden duplicates
          var candidates = Array.from(lrNow.children).reverse();
          var block = candidates.find(n => n.nodeType===1 && (!n.style || n.style.display !== "none")) || candidates[0];
          html = block ? block.innerHTML : "";
        }

        if (html && html.trim()) {
          targets.forEach(t => { try { t.dispatchEvent(new MouseEvent("mouseleave", {bubbles:true})); } catch(e){} });
          clearInterval(timer);
          resolve(html);
        } else if (tries >= max) {
          targets.forEach(t => { try { t.dispatchEvent(new MouseEvent("mouseleave", {bubbles:true})); } catch(e){} });
          clearInterval(timer);
          resolve("");
        }
      }, 100);
    });
  }

  // ---------- Convert tooltip HTML to tidy rows ----------
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

    // quick map to avoid duplicates
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

    // Known rows first
    order.forEach(function(lbl){
      var r = rows.find(x => x.label === lbl);
      if (r && remaining.has(keyOf(r))) {
        appendRow(r);
        remaining.delete(keyOf(r));
      }
    });

    // Then any leftovers
    rows.forEach(function(r){
      var k = keyOf(r);
      if (remaining.has(k)) {
        appendRow(r);
        remaining.delete(k);
      }
    });

    return box;
  }

  // ---------- Process a single event ----------
  async function processEvent(evtEl){
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
    } catch(e){
      console.warn("[STLS] warehouse extra failed", e);
    }
  }

  function processAll(){
    injectCSS();
    document.querySelectorAll(".warehouse_event").forEach(processEvent);
  }

  function watchForNew(){
    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes && Array.from(m.addedNodes).forEach(function(n){
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(".warehouse_event")) processEvent(n);
          else if (n.querySelectorAll) n.querySelectorAll(".warehouse_event").forEach(processEvent);
        });
      });
    });
    obs.observe(document.body, { childList:true, subtree:true });
  }

  // ---------- start ----------
  ready(function(){
    let tries=0, t=setInterval(function(){
      tries++;
      // Only run on HireHop pages; warehouse schedule has .warehouse_event blocks
      if (document.querySelector(".warehouse_event")) {
        clearInterval(t);
        processAll();
        watchForNew();
      }
      if (tries>120) clearInterval(t); // ~12s cutoff
    }, 100);
  });
})();
