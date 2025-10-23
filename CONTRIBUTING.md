Thank you for your interest in contributing to this small educational demo! Contributions that improve clarity, add examples, or fix bugs are welcome.

Guidelines

- Issues
  - Open an issue to report bugs or suggest features. Include steps to reproduce and a short description of the expected behavior.

- Pull requests
  - Fork the repo and create a topic branch for your change.
  - Keep changes small and focused.
  - Include a brief description of what you changed and why.
  - If the change affects behavior, include a short testing note describing how to verify it.

- Code style
  - Keep code simple and readable; use comments where the behavior might be non-obvious.
  - JavaScript should follow common idioms (ES5/ES6 compatible is fine here).

- Running locally
  - You can open `index.html` directly in your browser or run a simple HTTP server. From PowerShell:

```powershell
# Open in default browser
Start-Process .\index.html

# Or serve on a local HTTP server (recommended for some browsers)
python -m http.server 8000
# then open http://localhost:8000
```

- Tests
  - This project doesn't include automated tests. If you add any, include instructions in this file.

- License
  - By contributing you agree that your contributions will be licensed under the project's license (see `LICENSE`).

Thanks — your changes make this demo more useful for learners and teachers!