# Release verification record

Release: 1.1.0. Date: 2026-11-21.

| Check | Actual result |
| --- | --- |
| Local Node runtime | v24.22.3 on Linux |
| Built-in automated tests | 24 passed, 0 failed, 0 skipped |
| JavaScript syntax and UI references | Passed |
| English repository text policy | Passed; repository content also authored/reviewed in English |
| Standalone preview generation | Passed |
| SVG asset XML | Passed |
| GitHub workflow YAML parsing | Passed |
| Chromium page/visual checks | Not completed; browser launch blocked by container socket permissions |
| GitHub-hosted CI matrix | Configured; not executed in a remote repository |
| Windows/macOS launchers | Included; not physically tested on those operating systems |
| Physical phone and WLAN | Not tested; access/pairing protocol covered by automated tests |
| OBS / Streamlabs / Zoom | Setup documented; actual receiving-device test pending |
| Heard sound and audio routing | Pending target-system verification |

The optional browser script and manual workflow are supplied for the remaining interface checks. No visual or streaming pass is inferred from successful server tests. Run the acceptance record in `STREAMING.md` on the target computer.
