// stls-warehouse-extend-1.1.0.js
(function () {
  // ---------- tiny utils ----------
  function ready(fn){ document.readyState!=="loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  function injectCSSOnce(){
    if (document.getElementById("stls-warehouse-css")) return;
    const css = `
      .stls-warehouse-extra { margin-top:.5em; padding-top:.5em; border-top:1px dashed rgba(0,0,0,.25); font-size:12px; line-height:1.35; color:#222; }
      .stls-warehouse-extra .stls-row { margin:2px 0; display:flex; gap:.4em; }
      .stls-warehouse-extra .stls-label { font-weight:600; white-space:nowrap; }
      .stls-warehouse-extra .stls-muted { opacity:.8; }
      .stls-warehouse-extra hr { display:none; }
      /* Never flash tooltips while we work */
      .stls-hide-tooltips [id^="ui-id-"] { display:none !important; }
      .stls-hide-tooltips [role="tooltip"] { display:none !important; }
    `;
    const el=document.createElement("style"); el.id="stls-warehouse-css"; el.appendChild(document.createTextNode(css)); document.head.appendChild(el);
  }

  // ---------- DOM helpers ----------
  function titleNode(evtEl){ return evtEl.querySelector(".warehouse_event_maincell > div:nth-of-type(1)"); }
  function jobNoFromTitle(node){ if(!node) return null; const m=node.textContent.match(/\((\d+)\)/); return m?m[1]:null; }
  function getTooltipFromAria(evtEl){ const id=evtEl.getAttribute("aria-describedby"); return id?document.getElementById(id):null; }

  async function ensureTooltipNode(evtEl){
    let tip=getTooltipFromAria(evtEl);
    if (tip) return tip;

    document.documentElement.classList.add("stls-hide-tooltips");
    const target = evtEl.querySelector(".warehouse_event_maincell") || evtEl.querySelector(".last_subcell") || evtEl.querySelector(".first_subcell") || evtEl;

    if (target){
      const r=target.getBoundingClientRect();
      const x=r.left+Math.min(Math.max(5,r.width/2),r.width-5);
      const y=r.top +Math.min(Math.max(5,r.height/2),r.height-5);
      const opts={bubbles:true,cancelable:true,clientX:x,clientY:y,view:window};
      try{ target.dispatchEvent(new PointerEvent("pointerenter",opts)); }catch(e){}
      try{ target.dispatchEvent(new MouseEvent("mouseover",opts)); }catch(e){}
      try{ target.dispatchEvent(new MouseEvent("mouseenter",opts)); }catch(e){}
      try{ target.dispatchEvent(new MouseEvent("mousemove",opts)); }catch(e){}
    }
    for(let i=0;i<20;i++){ tip=getTooltipFromAria(evtEl); if(tip) break; await sleep(100); }
    if (target){
      try{ target.dispatchEvent(new MouseEvent("mouseleave",{bubbles:true,cancelable:true,view:window})); }catch(e){}
      try{ target.dispatchEvent(new PointerEvent("pointerleave",{bubbles:true,cancelable:true,view:window})); }catch(e){}
    }
    document.documentElement.classList.remove("stls-hide-tooltips");
    if (tip && tip.style) tip.style.display="none";
    return tip||null;
  }

  // ---------- parse/format ----------
  function normaliseLabel(lbl){
    if (!lbl) return lbl;
    const t = lbl.trim();
    if (t.toLowerCase().startsWith("return by")) return "Return By";
    if (t.toLowerCase()==="manager 2") return "Warehouse"; // user rename
    return t;
  }
  function timesOnly(val){
    if (!val) return val;
    const times = val.match(/\b\d{1,2}:\d{2}\b/g) || [];
    if (!times.length) return val;
    return times.length===1 ? times[0] : (times[0]+" - "+times[times.length-1]);
  }

  function buildInfoBlockFromTooltipNode(tipNode, jobNumberFromTitle){
    if (!tipNode) return null;
    const rawHTML = tipNode.innerHTML || "";
    if (!rawHTML.trim()) return null;

    const wrap=document.createElement("div"); wrap.innerHTML=rawHTML;
    const leafDivs=[...wrap.querySelectorAll("div")].filter(d=>!d.querySelector("div"));

    let rows=[];
    leafDivs.forEach(div=>{
      const t=(div.textContent||"").replace(/\s+/g," ").trim();
      if (!t) return;
      const idx=t.indexOf(" : ");
      if (idx>-1){
        const label=normaliseLabel(t.slice(0,idx).trim());
        const value=t.slice(idx+3).trim();
        rows.push({label,value});
      }else{
        rows.push({label:"",value:t,muted:true});
      }
    });

    // If missing, derive Job number from title (we hide it later anyway)
    if (jobNumberFromTitle && !rows.some(r=>r.label==="Job number")){
      rows.unshift({label:"Job number", value:jobNumberFromTitle});
    }

    // remove unwanted + format times
    const HIDE = new Set(["Job number","Job Start","Job Finish","Status"]);
    rows = rows.map(r=>{
      if (r.label==="Outgoing" || r.label==="Return By"){ return {label:r.label, value:timesOnly(r.value)}; }
      return r;
    }).filter(r=>!HIDE.has(r.label));

    // order with Warehouse after Manager
    const preferred = ["Outgoing","Return By","Customer/company name","Manager","Warehouse","Goods in","Job type","Collect from","Full Collection Address"];

    const box=document.createElement("div"); box.className="stls-warehouse-extra";
    const keyOf=r=>(r.label||"")+"|"+(r.value||"");
    const pool=new Map(rows.map(r=>[keyOf(r),r]));

    function addRow(r){
      const line=document.createElement("div");
      line.className="stls-row"+(r.muted?" stls-muted":"");
      if (r.label){ const lab=document.createElement("span"); lab.className="stls-label"; lab.textContent=r.label+":"; line.appendChild(lab); }
      const val=document.createElement("span"); val.textContent=r.value||""; line.appendChild(val);
      box.appendChild(line);
    }

    preferred.forEach(lbl=>{
      const r=rows.find(x=>x.label===lbl);
      if (r && pool.has(keyOf(r))){ addRow(r); pool.delete(keyOf(r)); }
    });
    rows.forEach(r=>{ const k=keyOf(r); if (pool.has(k)){ addRow(r); pool.delete(k);} });

    return box;
  }

  // ---------- Manager 2 (Warehouse) via job data ----------
  function pickManager2(obj){
    if (!obj || typeof obj!=="object") return null;

    // Helper: get any of these keys, in any case variant
    function getAny(o, names){
      if (!o || typeof o!=="object") return null;
      for (const name of names){
        // exact
        if (name in o && o[name]) return o[name];
        // upper
        const up=name.toUpperCase(); if (up in o && o[up]) return o[up];
        // lower
        const lo=name.toLowerCase(); if (lo in o && o[lo]) return o[lo];
      }
      return null;
    }

    function extractFrom(v){
      if (!v) return null;
      if (typeof v==="string" && v.trim()) return v.trim();
      if (typeof v==="object"){
        // common shapes
        const n = getAny(v, ["name","full_name","contact_name","display","DISPLAY","NAME","FULL_NAME"]);
        if (n && String(n).trim()) return String(n).trim();
      }
      return null;
    }

    // 1) Direct on root
    let v = getAny(obj, ["manager2","manager_2","warehouse","warehouse_manager","secondary_manager","managerTwo","managerSecond","warehouseContact","warehouse_contact"]);
    v = extractFrom(v); if (v) return v;

    // 2) Common containers
    const containers = ["job","JOB","data","DATA","details","DETAILS","result","RESULT","payload","PAYLOAD"];
    for (const k of containers){ if (obj[k]){ v = getAny(obj[k], ["manager2","manager_2","warehouse","warehouse_manager","secondary_manager","warehouse_contact"]); v = extractFrom(v); if (v) return v; } }

    // 3) Contacts-style arrays/objects
    const deep = ["contacts","CONTACTS","contact","CONTACT","customer","CUSTOMER","client","CLIENT","people","PEOPLE","staff","STAFF"];
    for (const k of deep){
      const x = obj[k];
      if (Array.isArray(x)){ for (const it of x){ const got = pickManager2(it); if (got) return got; } }
      else if (x && typeof x==="object"){ const got = pickManager2(x); if (got) return got; }
    }

    return null;
  }

  async function tryGetManager2(jobNo){
    // Returns string or null
    // A) Built-in helper used by many HireHop widgets
    const viaHH = async ()=>{
      const f = window.hh_api_call;
      if (typeof f!=="function") return null;

      // Try several command/param spellings
      const payloads = [
        ["get_job",{ID:jobNo}],      // UPPERCASE like job_data keys
        ["get_job",{JOB_NO:jobNo}],
        ["get_job",{job_no:jobNo}],
        ["job_get",{ID:jobNo}],
        ["job_get",{JOB_NO:jobNo}],
        ["job_get",{job_no:jobNo}],
      ];
      for (const [cmd,params] of payloads){
        try{
          const data = await new Promise((res,rej)=>{
            let done=false;
            f(cmd, params, function(resp){ done=true; res(resp); });
            setTimeout(()=>{ if(!done) rej(new Error("timeout")); }, 1500);
          });
          const m2 = pickManager2(data);
          if (m2) return m2;
        }catch(e){}
      }
      return null;
    };

    // B) Fallback: same-origin JSON endpoint patterns
    const viaAjax = async ()=>{
      if (!(window.$ && $.getJSON)) return null;
      const urls = [
        `/php/api.php?fn=get_job&JOB_NO=${encodeURIComponent(jobNo)}`,
        `/php/api.php?fn=get_job&job_no=${encodeURIComponent(jobNo)}`,
        `/php/api.php?fn=job_get&JOB_NO=${encodeURIComponent(jobNo)}`,
        `/php/api.php?fn=job_get&job_no=${encodeURIComponent(jobNo)}`
      ];
      for (const u of urls){
        try{
          const data = await new Promise((res,rej)=>{
            $.getJSON(u).done(res).fail(()=>rej(new Error("ajax fail")));
            setTimeout(()=>rej(new Error("timeout")), 1500);
          });
          const m2 = pickManager2(data);
          if (m2) return m2;
        }catch(e){}
      }
      return null;
    };

    let v = await viaHH(); if (v) return v;
    v = await viaAjax();  if (v) return v;
    return null;
  }

  function insertWarehouseRow(boxEl, warehouseName){
    if (!boxEl || !warehouseName) return;
    // Avoid duplicates
    const exists = Array.from(boxEl.querySelectorAll(".stls-row .stls-label")).some(l=>l.textContent==="Warehouse:");
    if (exists) return;

    const rows = boxEl.querySelectorAll(".stls-row");
    let insertAfter = null;
    rows.forEach(r=>{
      const lab=r.querySelector(".stls-label");
      if (lab && /(^|\s)Manager:/.test(lab.textContent)) insertAfter = r;
    });

    const line=document.createElement("div");
    line.className="stls-row";
    const lab=document.createElement("span"); lab.className="stls-label"; lab.textContent="Warehouse:"; line.appendChild(lab);
    const val=document.createElement("span"); val.textContent=warehouseName; line.appendChild(val);

    if (insertAfter && insertAfter.parentNode) {
      insertAfter.parentNode.insertBefore(line, insertAfter.nextSibling);
    } else {
      const afterRB = Array.from(rows).find(r=> (r.querySelector(".stls-label")||{}).textContent==="Return By:");
      if (afterRB && afterRB.parentNode) afterRB.parentNode.insertBefore(line, afterRB.nextSibling);
      else boxEl.appendChild(line);
    }
  }

  // ---------- per-event ----------
  async function processEvent(evtEl){
    if (evtEl.dataset.stlsProcessed) return;
    evtEl.dataset.stlsProcessed="1";

    const container = evtEl.querySelector(".warehouse_event_maincell") || evtEl;
    const old = container.querySelector(".stls-warehouse-extra"); if (old) old.remove();

    const tnode = titleNode(evtEl);
    const jobNo = jobNoFromTitle(tnode);

    const tipNode = getTooltipFromAria(evtEl) || await ensureTooltipNode(evtEl);
    const block = buildInfoBlockFromTooltipNode(tipNode, jobNo);

    if (block) {
      container.appendChild(block);

      // Enrich with Warehouse (Manager 2) from job data (non-blocking; if it fails, we skip)
      if (jobNo){
        try{
          const m2 = await Promise.race([ tryGetManager2(jobNo), sleep(2000).then(()=>null) ]);
          if (m2 && typeof m2==="string" && m2.trim()){
            insertWarehouseRow(block, m2.trim());
          }
        }catch(e){}
      }
    } else {
      const fb=document.createElement("div"); fb.className="stls-warehouse-extra"; fb.textContent="(No extra info available)"; container.appendChild(fb);
    }
  }

  async function processAllSequential(){
    injectCSSOnce();
    const list=[...document.querySelectorAll(".warehouse_event")];
    for (const evt of list){ await processEvent(evt); await sleep(60); }
  }

  function watchForNewSequential(){
    const queue=[]; let running=false;
    async function runQueue(){
      if (running) return; running=true;
      while(queue.length){
        const e=queue.shift();
        if (!document.body.contains(e) || e.dataset.stlsProcessed) continue;
        await processEvent(e); await sleep(60);
      }
      running=false;
    }
    const obs=new MutationObserver(muts=>{
      muts.forEach(m=>{
        [...(m.addedNodes||[])].forEach(n=>{
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(".warehouse_event")) queue.push(n);
          else if (n.querySelectorAll) n.querySelectorAll(".warehouse_event").forEach(x=>queue.push(x));
        });
      });
      if (queue.length) runQueue();
    });
    obs.observe(document.body,{childList:true,subtree:true});
  }

  // ---------- start ----------
  ready(function(){
    let tries=0, t=setInterval(function(){
      tries++;
      if (document.querySelector(".warehouse_event")){
        clearInterval(t);
        processAllSequential().then(watchForNewSequential);
      }
      if (tries>150) clearInterval(t);
    },100);
  });
})();
