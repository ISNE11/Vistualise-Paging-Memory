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

    // Page table
    ptTableBody.innerHTML = '';
    for(let p=0;p<NUM_PAGES;p++){
      const e = pageTable[p];
      const tr = document.createElement('tr');
      tr.dataset.page = p;
      tr.innerHTML = `<td>${p}</td><td>${e.present?e.frame:'-'}</td><td>${e.present?'Y':'N'}</td>`;
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
    if(Number.isNaN(page) || Number.isNaN(offset) || page<0 || page>=NUM_PAGES){ msgEl.textContent = 'Invalid page or offset out of range.'; return; }

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
      // age reset
      tlb[tlbIndex].age = 0;
      renderTables();
      return;
    }

    // TLB miss
    msgEl.innerHTML = `<strong>TLB miss</strong>. Checking page table...`;
    // highlight TLB area as miss briefly
    // find in page table
    const pte = pageTable[page];
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
      return;
    }

    // Page not present -> page fault
    highlightPage(page,'miss');
    msgEl.innerHTML = `<strong>Page fault</strong> — page ${page} not in memory. Simulating load into a free frame...`;
    // simulate loading: find free frame or choose one to evict
    setTimeout(()=>{
      let free = physical.findIndex(f=>!f.contents);
      if(free===-1){
        // choose simple victim: frame 0
        free = 0;
        // find which page maps to that frame
        const victimPage = pageTable.findIndex(e=>e.present && e.frame===free);
        if(victimPage!==-1){
          pageTable[victimPage].present = false;
          pageTable[victimPage].frame = null;
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
    }, 750);
  }

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

})();
