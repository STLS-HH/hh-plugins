// stls-warehouse-extend-1.0.8.js
(function () {
  // ---------- helpers ----------
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
      .stls-hide-tooltips [id^="ui-id-"] { display:none !important; }
      .stls-hide-tooltips [role="tooltip"] { display:none !important; }
    `;
    var el=document.createElement("style");
    el.id="stls-warehouse-css";
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  }

  // ---------- finders ----------
  function findEventTitleNode(evtEl){
    return evtEl.querySelector(".warehouse_event_maincell > div:nth-of-type(1)");
  }
  function extractJobNumberFromTitle(titleNode){
    if (!titleNode) return null;
    var m = titleNode.textContent.match(/\((\d+)\)/);
    return m ? m[1] : null;
  }
  function getTooltipFromAria(evtEl){
    var id = evtEl.getAttribute("aria-describedby");
    return id ? document.getElementById(id) : null;
  }

  // ---------- ensure tooltip exists ----------
  async function ensureTooltipNode(evtEl){
    var tip = getTooltipFromAria(evtEl);
    if (tip) return tip;

    document.documentElement.classList.add("stls-hide-tooltips");
    var target =
      evtEl.querySelector(".warehouse_event_maincell") ||
      evtEl.querySelector(".last_subcell") ||
      evtEl.querySelector(".first_subcell") ||
      evtEl;

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

    for (let i=0;i<20;i++){
      tip = getTooltipFromAria(evtEl);
      if (tip) break;
      await sleep(100);
    }

    if (target) {
      try { target.dispatchEvent(new MouseEvent("mouseleave", { bubbles:true, cancelable:true, view:window })); } catch(e){}
      try { target.dispatchEvent(new PointerEvent("pointerleave", { bubbles:true, cancelable:true, view:window })); } catch(e){}
    }
    document.documentElement.classList.remove("stls-hide-tooltips");

    if (tip && tip.style) tip.style.display = "none";
    return tip || null;
  }

  // ---------- parsing helpers ----------
  function normaliseLabel(lbl){
    if (!lbl) return lbl;
    var t = lbl.trim();
    if (t.toLowerCase().startsWith("return by")) return "Return By";
    if (t.toLowerCase() === "manager 2") return "Warehouse";
    return t;
  }
  function timesOnly(val){
    if (!val) return val;
    var times = (val.match(/\b\d{1,2}:\d{2}\b/g) || []);
    if (!times.length) return val;
    return times.length === 1 ? times[0] : (times[0] + " - " + times[times.length-1]);
  }

  // ---------- build info block ----------
  function buildInfoBlockFromTooltipNode(tipNode, jobNumberFromTitle){
    if (!tipNode) return null;
    var rawHTML = tipNode.innerHTML || "";
    if (!rawHTML.trim()) return null;

    var wrap = document.createElement("div");
    wrap.innerHTML = rawHTML;

    var allDivs = Array.from(wrap.querySelectorAll("div"));
    var leafDivs = allDivs.filter(d => !d.querySelector("div"));

    var rows = [];
    leafDivs.forEach(function(div){
      var t = (div.textContent || "").replace(/\s+/g," ").trim();
      if (!t) return;
      var idx = t.indexOf(" : ");
      if (idx > -1) {
        var label = normaliseLabel(t.slice(0, idx).trim());
        var value = t.slice(idx+3).trim();
        rows.push({ label, value });
      } else {
        rows.push({ label:"", value:t, muted:true });
      }
    });

    if (jobNumberFromTitle && !rows.some(r => r.label === "Job number")) {
      rows.unshift({ label: "Job number", value: jobNumberFromTitle });
    }

    // Hide unwanted labels
    var HIDE_LABELS = new Set(["Job number","Job Start","Job Finish","Status"]);

    rows = rows.map(function(r){
      if (r.label === "Outgoing" || r.label === "Return By") {
        return { label: r.label, value: timesOnly(r.value) };
      }
      return r;
    }).filter(r => !HIDE_LABELS.has(r.label));

    // Order with Warehouse just after Manager
    var preferredOrder = [
      "Outgoing",
      "Return By",
      "Customer/company name",
      "Manager",
      "Warehouse",             // renamed Manager 2
      "Goods in",
      "Job type",
      "Collect from",
      "Full Collection Address"
    ];

    var box = document.createElement("div");
    box.className = "stls-warehouse-extra";

    var keyOf = r => (r.label||"") + "|" + (r.value||"");
    var remaining = new Map(rows.map(r => [keyOf(r), r]));

    function addRow(r){
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

    preferredOrder.forEach(function(lbl){
      var r = rows.find(x => x.label === lbl);
      if (r && remaining.has(keyOf(r))) { addRow(r); remaining.delete(keyOf(r)); }
    });
    rows.forEach(function(r){
      var k = keyOf(r);
      if (remaining.has(k)) { addRow(r); remaining.delete(k); }
    });

    return box;
  }

  // ---------- process events ----------
  async function processEvent(evtEl){
    if (evtEl.dataset.stlsProcessed) return;
    evtEl.dataset.stlsProcessed = "1";

    var container = evtEl.querySelector(".warehouse_event_maincell") || evtEl;
    var old = container.querySelector(".stls-warehouse-extra");
    if (old) old.remove();

    var titleNode = findEventTitleNode(evtEl);
    var jobNo = extractJobNumberFromTitle(titleNode);

    var tipNode = getTooltipFromAria(evtEl) || await ensureTooltipNode(evtEl);
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
      await sleep(60);
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

  // ---------- start ----------
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
