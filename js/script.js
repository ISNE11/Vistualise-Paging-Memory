// Simple paging + TLB visualizer
(function(){
  // Configuration: small sizes for demo
  const NUM_PAGES = 8;
  const NUM_FRAMES = 6;
  const TLB_ENTRIES = 4;

  // Data structures
  const pageTable = new Array(NUM_PAGES).fill(null).map(()=>({present:false, frame:null}));
  const physical = new Array(NUM_FRAMES).fill(null).map(()=>({contents:null}));
  const tlb = new Array(TLB_ENTRIES).fill(null).map(()=>({page:null,frame:null,valid:false,age:0}));

  // For demo, preload some pages into frames
  function seedInitialState(){
    // Map pages 0,1,3,4 into frames
    const initial = [{p:0,f:2},{p:1,f:0},{p:3,f:1},{p:4,f:4}];
    initial.forEach(e=>{
      pageTable[e.p].present = true;
      pageTable[e.p].frame = e.f;
      physical[e.f].contents = `Page ${e.p} data`;
    });
    // preload one TLB entry
    tlb[0] = {page:1,frame:0,valid:true,age:0};
  }

  // Build UI tables
  const tlbTableBody = document.querySelector('#tlb-table tbody');
  const ptTableBody = document.querySelector('#pt-table tbody');
  const memTableBody = document.querySelector('#mem-table tbody');
  const msgEl = document.getElementById('message');

  function renderTables(){
    // TLB
    tlbTableBody.innerHTML = '';
    tlb.forEach((e,i)=>{
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `<td>${i}</td><td>${e.valid?e.page:'-'}</td><td>${e.valid?e.frame:'-'}</td><td>${e.valid?'Y':'N'}</td>`;
      tlbTableBody.appendChild(tr);
    });

    // Page table (use dynamic length so added pages appear)
    ptTableBody.innerHTML = '';
    for(let p=0;p<pageTable.length;p++){
      const e = pageTable[p] || {present:false,frame:null};
      const tr = document.createElement('tr');
      tr.dataset.page = p;
      // show deleted pages distinctly
      if(e.deleted){
        tr.innerHTML = `<td>${p}</td><td>-</td><td>deleted</td>`;
        tr.classList.add('deleted');
      } else {
        tr.innerHTML = `<td>${p}</td><td>${e.present?e.frame:'-'}</td><td>${e.present?'Y':'N'}</td>`;
      }
      ptTableBody.appendChild(tr);
    }

    // Memory
    memTableBody.innerHTML = '';
    for(let f=0;f<NUM_FRAMES;f++){
      const e = physical[f];
      const tr = document.createElement('tr');
      tr.dataset.frame = f;
      tr.innerHTML = `<td>${f}</td><td>${e.contents?e.contents:'(free)'} </td>`;
      memTableBody.appendChild(tr);
    }
  }

  // Utility: clear highlights
  function clearHighlights(){
    document.querySelectorAll('tr').forEach(r=>{
      r.classList.remove('row-highlight','hit','miss','mem-highlight');
    });
  }

  // Event log helper
  const logList = document.getElementById('log-list');
  function logEvent(text,type){
    const li = document.createElement('li');
    li.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
    if(type) li.classList.add(type);
    logList.insertBefore(li, logList.firstChild);
  }

  // Simple LRU-ish: ages increase, replace highest age or invalid
  function tlbInsert(page,frame){
    // increment age
    tlb.forEach(e=>{ if(e.valid) e.age++; });
    // find invalid
    let idx = tlb.findIndex(e=>!e.valid);
    if(idx===-1){
      // replace largest age
      let maxAge = -1; idx = 0;
      tlb.forEach((e,i)=>{ if(e.age>maxAge){ maxAge=e.age; idx=i; } });
    }
    tlb[idx] = {page,frame,valid:true,age:0};
    renderTables();
  }

  // Highlight helpers
  function highlightTLBIndex(i,cls){
    clearHighlights();
    const row = tlbTableBody.querySelector(`tr[data-index='${i}']`);
    if(row) row.classList.add(cls||'row-highlight');
  }
  function highlightPage(p,cls){
    clearHighlights();
    const row = ptTableBody.querySelector(`tr[data-page='${p}']`);
    if(row) row.classList.add(cls||'row-highlight');
  }
  function highlightFrame(f,cls){
    clearHighlights();
    const row = memTableBody.querySelector(`tr[data-frame='${f}']`);
    if(row) row.classList.add(cls||'mem-highlight');
  }

  // Main translation
  function translateAddress(input){
    clearHighlights();
    msgEl.textContent = '';
    // parse
    const parts = input.split(',').map(s=>s.trim());
    if(parts.length!==2){ msgEl.textContent = 'Enter address as page,offset (e.g. 2,5).'; return; }
    const page = Number(parts[0]);
    const offset = Number(parts[1]);
  if(Number.isNaN(page) || Number.isNaN(offset) || page<0 || page>=pageTable.length){ msgEl.textContent = 'Invalid page or offset out of range.'; return; }

    // Check TLB
    let tlbHit = false; let frame = null; let tlbIndex = -1;
    for(let i=0;i<tlb.length;i++){
      const e = tlb[i];
      if(e.valid && e.page===page){ tlbHit=true; frame=e.frame; tlbIndex=i; break; }
    }
    if(tlbHit){
      highlightTLBIndex(tlbIndex,'hit');
      highlightFrame(frame,'mem-highlight');
      msgEl.innerHTML = `<strong>TLB hit</strong> — page ${page} → frame ${frame}. Physical address: (${frame},${offset})`;
      logEvent(`TLB hit: page ${page} -> frame ${frame}`,'info');
      // age reset
      tlb[tlbIndex].age = 0;
      renderTables();
      return;
    }

    // TLB miss
    msgEl.innerHTML = `<strong>TLB miss</strong>. Checking page table...`;
    logEvent(`TLB miss on page ${page}`,'info');
    // highlight TLB area as miss briefly
    // find in page table
    const pte = pageTable[page];
    // If page entry is missing or marked deleted, report error (not a normal page fault)
    if(!pte || pte.deleted){
      msgEl.textContent = `Error: page ${page} does not exist (not allocated).`;
      logEvent(`Access to non-existing page ${page}`,'error');
      // highlight CPU area to show error
      const cpu = document.getElementById('cpu');
      if(cpu){ cpu.classList.add('page-fault-highlight'); setTimeout(()=>cpu.classList.remove('page-fault-highlight'),1200); }
      return;
    }
    if(pte.present){
      frame = pte.frame;
      // highlight page table row
      highlightPage(page,'hit');
      // insert into TLB
      tlbInsert(page,frame);
      // highlight newly inserted TLB entry
      const newIdx = tlb.findIndex(e=>e.valid && e.page===page);
      setTimeout(()=>{ highlightTLBIndex(newIdx,'hit'); highlightFrame(frame,'mem-highlight'); }, 350);
      msgEl.innerHTML = `<strong>Page table hit</strong> — page ${page} is in frame ${frame}. Physical address: (${frame},${offset})`;
      logEvent(`Page table hit: page ${page} -> frame ${frame}`,'info');
      return;
    }

    // Page not present -> page fault
    highlightPage(page,'miss');
    msgEl.innerHTML = `<strong>Page fault</strong> — page ${page} not in memory. Simulating load into a free frame...`;
    logEvent(`Page fault on page ${page}`,'fault');
    // visually mark page fault on PT table
    const pRow = ptTableBody.querySelector(`tr[data-page='${page}']`);
    if(pRow) pRow.classList.add('page-fault-highlight');
    // simulate loading: find free frame or choose one to evict
    setTimeout(()=>{
      // remove page-fault highlight
      if(pRow) pRow.classList.remove('page-fault-highlight');
      let free = physical.findIndex(f=>!f.contents);
      if(free===-1){
        // choose simple victim: frame 0
        free = 0;
        // find which page maps to that frame
        const victimPage = pageTable.findIndex(e=>e.present && e.frame===free);
        if(victimPage!==-1){
          pageTable[victimPage].present = false;
          pageTable[victimPage].frame = null;
          // invalidate any TLB entries mapping the victim page
          tlb.forEach((te,idx)=>{ if(te.valid && te.page===victimPage){ tlb[idx].valid=false; logEvent(`Evicted page ${victimPage} from TLB (invalidated)`, 'info'); } });
        }
      }
      // bring page into free frame
      pageTable[page].present = true;
      pageTable[page].frame = free;
      physical[free].contents = `Page ${page} data`;
      // Insert into TLB
      tlbInsert(page,free);
      renderTables();
      highlightPage(page,'hit');
      highlightFrame(free,'mem-highlight');
      msgEl.innerHTML = `<strong>Page loaded</strong> into frame ${free}. Physical address: (${free},${offset})`;
      logEvent(`Loaded page ${page} into frame ${free}`,'info');
    }, 750);
  }

  // --------------- Page add/delete UI ---------------
  document.getElementById('add-page').addEventListener('click', ()=>{
    const v = document.getElementById('new-page').value.trim();
    const p = Number(v);
    if(!Number.isInteger(p) || p<0){ logEvent('Invalid page number to add','error'); return; }
    if(p < pageTable.length){ logEvent(`Page ${p} already exists`, 'error'); return; }
    // extend page table to include up to p
    for(let i=pageTable.length;i<=p;i++) pageTable.push({present:false,frame:null});
    renderTables();
    logEvent(`Added page ${p}`,'info');
  });

  document.getElementById('del-page-btn').addEventListener('click', ()=>{
    const v = document.getElementById('del-page').value.trim();
    const p = Number(v);
    if(!Number.isInteger(p) || p<0 || p>=pageTable.length){ logEvent('Invalid page number to delete','error'); return; }
    // if present in frame, free frame
    if(pageTable[p].present){ const f = pageTable[p].frame; physical[f].contents = null; pageTable[p].present=false; pageTable[p].frame=null; logEvent(`Removed page ${p} from frame ${f}`,'info'); }
    // invalidate TLB entries with this page
    tlb.forEach((te,idx)=>{ if(te.valid && te.page===p){ tlb[idx].valid=false; logEvent(`Invalidated TLB entry ${idx} for deleted page ${p}`,'info'); } });
    // mark page as deleted (null entry) — keep index but mark
    pageTable[p] = {present:false,frame:null,deleted:true};
    renderTables();
    logEvent(`Deleted page ${p}`,'info');
  });


  // wire up
  seedInitialState();
  renderTables();

  document.getElementById('translate').addEventListener('click', ()=>{
    const v = document.getElementById('logical').value.trim();
    translateAddress(v);
  });

  document.getElementById('logical').addEventListener('keydown', (e)=>{
    if(e.key==='Enter') document.getElementById('translate').click();
  });

  // Interactive tooltips: clicking a panel briefly shows explanation in message
  document.querySelectorAll('[data-tooltip]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const text = el.getAttribute('data-tooltip');
      msgEl.textContent = text;
      setTimeout(()=>{ msgEl.textContent=''; }, 3500);
    });
  });

  // Add small click-to-inspect for rows
  ptTableBody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr'); if(!tr) return;
    const p = Number(tr.dataset.page);
    const e = pageTable[p];
    msgEl.textContent = `Page ${p}: present=${e.present} ${e.present?`frame=${e.frame}`:''}`;
  });
  tlbTableBody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr'); if(!tr) return;
    const i = Number(tr.dataset.index);
    const e = tlb[i];
    msgEl.textContent = `TLB entry ${i}: ${e.valid?`page=${e.page}, frame=${e.frame}`:'invalid'}`;
  });
  memTableBody.addEventListener('click', (ev)=>{
    const tr = ev.target.closest('tr'); if(!tr) return;
    const f = Number(tr.dataset.frame);
    const e = physical[f];
    msgEl.textContent = `Frame ${f}: ${e.contents?e.contents:'(free)'}`;
  });

  // ---------------- Tutorial & Flow Visualization ----------------
  const svg = document.getElementById('flow-svg');
  // layout coordinates for nodes
  const nodes = {
    cpu: {x:80,y:90,w:120,h:48,label:'CPU'},
    tlb: {x:270,y:30,w:140,h:48,label:'TLB'},
    pt:  {x:470,y:30,w:160,h:48,label:'Page Table'},
    mem: {x:720,y:60,w:160,h:64,label:'Physical Memory'}
  };

  function buildFlow(){
    // clear
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    // defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/></marker>';
    svg.appendChild(defs);

    // draw nodes
    for(const k of Object.keys(nodes)){
      const n = nodes[k];
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.classList.add('flow-node'); g.setAttribute('id','node-'+k);
      const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
      rect.setAttribute('x',n.x); rect.setAttribute('y',n.y); rect.setAttribute('width',n.w); rect.setAttribute('height',n.h);
      rect.setAttribute('rx',8);
      g.appendChild(rect);
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x',n.x + n.w/2); text.setAttribute('y', n.y + n.h/2 + 5);
      text.setAttribute('text-anchor','middle'); text.setAttribute('class','flow-label');
      text.textContent = n.label;
      g.appendChild(text);
      svg.appendChild(g);
    }

    // arrows: CPU -> TLB, TLB -> PT, PT -> MEM, TLB -> MEM (for direct hit path)
    function line(x1,y1,x2,y2,id){
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${x1} ${y1} L ${x2} ${y2}`;
      path.setAttribute('d',d); path.setAttribute('class','arrow'); path.setAttribute('id',id);
      svg.appendChild(path);
    }

    const cpuMid = {x:nodes.cpu.x + nodes.cpu.w, y: nodes.cpu.y + nodes.cpu.h/2};
    const tlbMid = {x:nodes.tlb.x, y: nodes.tlb.y + nodes.tlb.h/2};
    const tlbRight = {x:nodes.tlb.x + nodes.tlb.w, y: nodes.tlb.y + nodes.tlb.h/2};
    const ptMid = {x:nodes.pt.x, y: nodes.pt.y + nodes.pt.h/2};
    const ptRight = {x:nodes.pt.x + nodes.pt.w, y: nodes.pt.y + nodes.pt.h/2};
    const memMid = {x:nodes.mem.x, y: nodes.mem.y + nodes.mem.h/2};

    line(cpuMid.x, cpuMid.y, tlbMid.x, tlbMid.y, 'a-cpu-tlb');
    line(tlbRight.x, tlbRight.y, ptMid.x, ptMid.y, 'a-tlb-pt');
    line(ptRight.x, ptRight.y, memMid.x, memMid.y, 'a-pt-mem');
    // direct path from tlb to mem (represent fast hit)
    line(tlbRight.x, tlbRight.y+10, memMid.x, memMid.y+10, 'a-tlb-mem');
  }

  buildFlow();

  // tutorial state
  let tutStep = 0; let tutActive = false; let tutSequence = [];

  function resetTutorialUI(){
    tutStep = 0; tutActive = false; tutSequence = [];
    document.querySelectorAll('.arrow').forEach(a=>a.classList.remove('active','flow-pulse'));
    document.querySelectorAll('.tutorial-steps li').forEach(li=>li.classList.remove('active'));
    clearHighlights();
    msgEl.textContent = '';
  }

  function highlightStep(i){
    document.querySelectorAll('.tutorial-steps li').forEach(li=>li.classList.remove('active'));
    const el = document.querySelector(`.tutorial-steps li[data-step='${i}']`);
    if(el) el.classList.add('active');
  }

  // Build a sequence based on an address: decide whether TLB or PT hit
  function buildSequenceForAddress(addr){
    const parts = addr.split(',').map(s=>s.trim());
    const page = Number(parts[0]);
    // check current TLB and page table state
    let tlbHit=false; let ptHit=false; let tlbIndex=-1; let frame=null;
    // if page doesn't exist, return error sequence
    if(!pageTable[page] || pageTable[page].deleted){
      const seq = [{arrow:'a-cpu-tlb',desc:`Access to non-existing page ${page}`,error:true}];
      return {seq,tlbHit:false,ptHit:false,frame:null};
    }
    for(let i=0;i<tlb.length;i++){ const e=tlb[i]; if(e.valid && e.page===page){ tlbHit=true; tlbIndex=i; frame=e.frame; break; } }
    if(!tlbHit){ if(pageTable[page] && pageTable[page].present){ ptHit=true; frame=pageTable[page].frame; } }
    // sequence of arrows to animate
    const seq = [];
    seq.push({arrow:'a-cpu-tlb',desc:'CPU -> TLB (lookup)'});
    if(tlbHit){ seq.push({arrow:'a-tlb-mem',desc:`TLB hit: page ${page} -> frame ${frame}`}); }
    else{
      seq.push({arrow:'a-tlb-pt',desc:'TLB miss: consult Page Table'});
      if(ptHit) seq.push({arrow:'a-pt-mem',desc:`Page table hit: page ${page} -> frame ${frame}`});
      else seq.push({arrow:'a-pt-mem',desc:'Page fault: load page into frame and update page table/TLB',fault:true});
    }
    return {seq,tlbHit,ptHit,frame};
  }

  function runTutorialOnce(addr,stepCallback,done){
    resetTutorialUI();
    const info = buildSequenceForAddress(addr);
    tutSequence = info.seq;
    tutActive = true;
    let i = 0;
    function step(){
      if(i>=tutSequence.length){ tutActive=false; if(done) done(info); return; }
      const s = tutSequence[i];
      // animate arrow
      const a = document.getElementById(s.arrow);
      if(a){ a.classList.add('active','flow-pulse'); }
      highlightStep(i);
      // call step callback to update highlights
      if(stepCallback) stepCallback(i,s,info);
      setTimeout(()=>{ if(a) a.classList.remove('flow-pulse'); i++; step(); }, 900);
    }
    step();
  }

  // tutorial control handlers
  document.getElementById('tutorial-reset').addEventListener('click', ()=>{ resetTutorialUI(); });
  document.getElementById('tutorial-run').addEventListener('click', ()=>{
    const addr = document.getElementById('tutorial-address').value.trim() || '1,0';
    runTutorialOnce(addr,(i,s,info)=>{
      // on each step, update highlights
      clearHighlights();
      if(i===0){ // CPU -> TLB
        const parts = addr.split(',').map(x=>x.trim()); const page=Number(parts[0]);
        highlightTLBIndex(-1); // nothing
      } else if(s.arrow==='a-tlb-mem'){
        // tlb hit
        const parts = addr.split(',').map(x=>x.trim()); const page=Number(parts[0]);
        const entry = tlb.findIndex(e=>e.valid && e.page===page);
        if(entry!==-1){ highlightTLBIndex(entry,'hit'); highlightFrame(tlb[entry].frame,'mem-highlight'); msgEl.textContent = s.desc; }
      } else if(s.arrow==='a-tlb-pt'){
        const parts = addr.split(',').map(x=>x.trim()); const page=Number(parts[0]);
        highlightPage(page,'row-highlight'); msgEl.textContent = s.desc;
      } else if(s.arrow==='a-pt-mem'){
        const parts = addr.split(',').map(x=>x.trim()); const page=Number(parts[0]);
        if(pageTable[page] && pageTable[page].present){ highlightPage(page,'hit'); highlightFrame(pageTable[page].frame,'mem-highlight'); msgEl.textContent = s.desc; }
        else { msgEl.textContent = s.desc; }
      }
    },(info)=>{
      // done
      // if page fault, simulate load (reuse translation code)
      const parts = (document.getElementById('tutorial-address').value || '1,0').split(',').map(s=>s.trim());
      translateAddress(parts.join(','));
    });
  });

  // Step mode
  document.getElementById('tutorial-step').addEventListener('click', ()=>{
    const addr = document.getElementById('tutorial-address').value.trim() || '1,0';
    if(!tutActive || tutSequence.length===0){
      // initialize sequence
      resetTutorialUI();
      const info = buildSequenceForAddress(addr);
      tutSequence = info.seq; tutActive = true; tutStep = 0;
    }
    if(tutStep < tutSequence.length){
      const s = tutSequence[tutStep];
      const a = document.getElementById(s.arrow);
      if(a) { a.classList.add('active'); setTimeout(()=>a.classList.remove('active'),700); }
      highlightStep(tutStep);
      // update highlights similar to run
      clearHighlights();
      const parts = addr.split(',').map(x=>x.trim()); const page=Number(parts[0]);
      if(tutStep===0){ /* cpu->tlb */ }
      else if(s.arrow==='a-tlb-mem'){ const entry = tlb.findIndex(e=>e.valid && e.page===page); if(entry!==-1){ highlightTLBIndex(entry,'hit'); highlightFrame(tlb[entry].frame,'mem-highlight'); msgEl.textContent = s.desc; } }
      else if(s.arrow==='a-tlb-pt'){ highlightPage(page,'row-highlight'); msgEl.textContent = s.desc; }
      else if(s.arrow==='a-pt-mem'){ if(pageTable[page] && pageTable[page].present){ highlightPage(page,'hit'); highlightFrame(pageTable[page].frame,'mem-highlight'); msgEl.textContent = s.desc; } else { msgEl.textContent = s.desc; } }
      tutStep++;
    } else {
      // end
      tutActive=false; tutSequence=[]; tutStep=0;
      // if finished and last was page fault, run translation to simulate load
      translateAddress(document.getElementById('tutorial-address').value || '1,0');
    }
  });


})();
