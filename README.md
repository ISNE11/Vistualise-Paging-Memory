# Paging & TLB Visualization

A small, client-side demo that visualizes virtual-to-physical address translation using a simple TLB and page table model.

This project is intentionally minimal and self-contained so you can open the HTML in a browser and experiment with translation, TLB hits/misses, and page faults.

## Features

- Interactive single-page UI that simulates address translation
- Visual highlights for TLB hits, page table hits, and page faults
- Simple replacement policy for TLB and a naive victim selection for frame eviction (easy to modify)

## Files

- `index.html` — application UI
- `css/styles.css` — styles and layout
- `js/script.js` — simulation logic and UI wiring (configuration constants at the top)

## Quick start

Open the demo in your browser. Two easy ways from PowerShell:

```powershell
# Open the file in your default browser
Start-Process .\index.html
```

In the page UI:
- Enter a logical address in the format `page,offset` (example: `2,5`) and click Translate.
- The UI shows whether the translation used the TLB, the page table, or triggered a page fault.

## Configuration

You can change the simulation size and behavior by editing the constants at the top of `js/script.js`. Typical variables to look for:

- number of pages / logical address space size
- number of physical frames
- TLB size
- any preloaded page/frame state used for demonstrations

Adjusting these values is a quick way to show different behaviours (higher page count → more page faults, smaller TLB → more misses, etc.).

## Usage examples

- `2,5` — translate page 2 with offset 5
- `0,0` — first byte of page 0

Tip: Try sequences of translations to observe how the TLB warms up and how page faults populate frames.

## For educators

- Modify the constants and reload the page to create classroom exercises.
- Use step-by-step translations to demonstrate translation lookups, TLB caching, and page fault handling.

## Contributing

This is a small demo intended for learning and teaching. Contributions that improve clarity, add examples, or fix bugs are welcome. Please read `CONTRIBUTING.md` for details on reporting issues and submitting pull requests.

## License

This project is available under the terms of the MIT License — see `LICENSE` for details.

## Notes

- This demo is not a production emulator. Replacement policies and eviction choices are simplified to make the flow easy to follow.
- If you want help adding features (different replacement policies, statistics, or exportable traces), tell me what you'd like and I can implement them.
