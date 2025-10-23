# Paging & TLB Visualization

This is a small client-side demo that visualizes virtual address translation using a TLB and a page table into physical memory.

Files:

- `index.html` — single-page web UI
- `css/styles.css` — styles and layout
- `js/script.js` — translation logic and UI wiring

How to open:

1. Open `index.html` in your browser (double-click or open file).
2. Enter a logical address in the input box using the format `page,offset` (for example `2,5`) and click Translate.

Behavior:

- The demo contains a small TLB (4 entries), a page table (8 pages), and physical memory (6 frames).
- Some pages are preloaded. TLB and page table hits are highlighted.
- On a page fault, the demo simulates loading the page into a free frame (or evicting a simple victim) and updates the page table and TLB.

Notes for educators:

- You can modify the constants at the top of `js/script.js` to change the number of pages/frames/TLB entries.
- The simulation uses a simple replacement policy for TLB (age-based) and naive eviction for demonstration.

Enjoy experimenting and teaching address translation flows!
