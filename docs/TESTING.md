# Testing and verification

## Built-in checks

```sh
npm run verify
```

The check script validates JavaScript syntax, static UI IDs, standalone bundle syntax and the English source policy. Node tests cover the timer, schema, access control, HTTP/SSE, persistence and preview adapter. No external test framework is needed.

Covered behavior includes:

- Duplicate start, pause/resume precision, lead-in and delayed tick catch-up.
- Zero-rest and single-cycle intervals, final rest and stopwatch behavior.
- Active-setting locks, schema validation and plain-text handling.
- Read-only output and protected mutation endpoints.
- Foreign Origin/Host rejection and private-path denial.
- State delivered to independent SSE readers without resetting the session.
- Logo bytes, portable layout transfer and restart recovery.
- Serialized concurrent saves and preservation of invalid settings files.
- Pairing, session expiry, rate limits and one selected audio output.
- Standalone preview persistence and browser-storage failure handling.

## Optional browser smoke checks

Install the optional QA tool in a working checkout:

```sh
npm install --no-save --package-lock=false --ignore-scripts playwright@1.62.1
npx --no-install playwright install chromium
npm run build:preview
npm run test:browser
```

These packages are development tools, not runtime dependencies. The browser script launches temporary local servers and checks timer forms, modes, text rendering, logos, design, layout export/import, mobile viewport, pairing and standalone preview. Its temporary data is removed afterward.

The **Optional browser QA** GitHub workflow runs the same script on manual dispatch. It is separate from the default CI workflow.

For an already provisioned browser, the QA script accepts `WODCAST_BROWSER_EXECUTABLE`; advanced environments can set `WODCAST_PLAYWRIGHT_MODULE` to an installed module URL. `WODCAST_QA_DIR` optionally writes internal review screenshots. These options are for test infrastructure, not application setup.

## Delivery verification limits

Local automated verification uses Node.js v24.22.3 on Linux. The configured GitHub matrix has not yet been run in the user's repository.

Chromium was present but its launch failed before page checks because the development container rejected a browser socket operation (`Operation not permitted`). No browser pass, visual layout pass, physical-phone pass or heard-audio pass is claimed.

Windows/macOS launchers, actual OBS/Streamlabs integration and Zoom receiving-device checks still need execution on the target system. Use `STREAMING.md` to record those results. The Firebase reference was not visually compared.

For a bug report, include the operating system, Node/browser/OBS versions, steps to reproduce and observed behavior. Include a minimal layout only after removing private session content.
