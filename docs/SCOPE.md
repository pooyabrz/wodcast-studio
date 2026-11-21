# Scope and budget planning

Version 1.1.0 uses the original brief's core-first approach. **Included** means implemented in source. **Limited** identifies a concrete boundary. **Future** means not implemented. Practical streaming acceptance is recorded separately.

| Function | Status | Boundary |
| --- | --- | --- |
| Left, center and right zones | Included | One primary layout |
| Transparent output | Included | Camera composition happens in OBS |
| Full HD | Included | 1920 x 1080 base canvas |
| Responsive output | Limited | Proportional 16:9; no separate portrait layout |
| Responsive control panel | Included | Narrow-view CSS provided; browser QA pending |
| Separate control/output views | Included | Independent HTML pages |
| Testable prototype | Included | Local server and standalone HTML preview |
| Logo upload | Limited | PNG/JPEG/WebP, 2 MB; UI decode and dimension check |
| Logo replacement | Included | One primary logo |
| Logo removal | Included | Control-panel action |
| Brand title | Included | Editable text |
| Training/event title | Included | Session field |
| Subtitle | Included | Editable text |
| Free text | Limited | Plain text with line breaks |
| Font selection | Limited | Three system font stacks; timer remains monospace |
| Text sizes | Included | Individual brand/session/subtitle/free/WOD/coach/notes/clock/timer sizes |
| Colors | Limited | Shared text, accent and separate timer color |
| Alignment | Included | Left/center/right for brand and WOD content |
| Element visibility | Included | Ten predefined switches |
| Countdown | Included | One second to 24 hours |
| Stopwatch | Included | Excludes lead-in and paused time |
| Start / pause / resume / reset | Included | Confirmed reset during an active session |
| Duration and lead-in | Included | Configurable values |
| Time cap | Limited | Standalone countdown mode |
| Number of rounds | Included | 1 to 200 timed rounds |
| Work and rest times | Included | Repeated fixed cycle, final rest included |
| Repeated intervals | Included | One work/rest pattern |
| Different consecutive intervals | Future | Needs a phase editor |
| Automatic phase switching | Included | Work/rest transitions |
| Current round/interval display | Included | Counts timed phases, not athlete repetitions |
| Timer size and color | Included | Within configurable limits |
| Green/yellow/red warnings | Limited | Two remaining-time thresholds |
| Sound cues | Limited | One selected browser panel; target audio test required |
| Keyboard shortcuts | Limited | Focused panel, outside input controls |
| Time expression input | Future | No `2m + 30 + 1:00` parser |
| AMRAP / EMOM / TABATA presets | Included | Timer presets; workout text edited separately |
| WOD and coach information | Included | Plain text |
| Notes and live clock | Included | Configurable time zone |
| Right-zone formatting | Limited | Font, size, color and alignment; no rich text |
| Adjustable zones | Limited | Numeric X/Y/width/height; no drag editor |
| Smartphone/tablet control | Limited | Same private network and pairing code |
| Internet remote control | Future | Needs public access/transport design |
| Saved layout and logo | Included | Explicit server-side save |
| Portable layout import/export | Included | JSON with embedded uploaded logo |
| Multiple saved scenes | Limited | External layout files; one active server configuration |
| Show/hide animation | Limited | Fade whole zones; element switches are immediate |
| Restore defaults | Included | Reset timer first; confirmation |
| Participant names | Future | Extension example in development guide |
| Sponsor logo rotation | Future | Additional asset module |
| Chat/information widgets | Future | Separate data/display module |
| OBS Browser Source | Included | Endpoint and setup; target-system test pending |
| Streamlabs | Limited | Compatibility path; practical test pending |
| Zoom via OBS Virtual Camera | Included | Setup path; receiving-device test pending |
| Local execution | Included | Node 22+ and zero runtime npm dependencies |
| Move to another private host | Included | Copy source and data to a suitable Node host |
| Public hosting | Future | No public deployment configuration |
| Readable source and project files | Included | All application, test, build and asset sources |
| English GitHub materials | Included | README, guides, workflows, issue/PR templates |
| Rights/component overview | Included | LICENSE and third-party notices |

## Example commercial milestones

This is a planning example for a separate written development agreement, not an invoice or an accepted commercial offer from an external contractor.

| Milestone | Fee | Proposed working days | Review condition |
| --- | ---: | --- | --- |
| Concept and scope | EUR 20 | 1 | Architecture, constraints and fixed scope |
| Testable prototype | EUR 80 | 2-4 | Three zones, timer, text, logo and transparency |
| Confirmed additions | EUR 40 | 5-6 | Agreed interval, storage and control features |
| Tests, fixes and handover | EUR 60 | 7-8 | Target streaming test, fixes, source and documentation |
| **Total** | **EUR 200** | | Review before payment release |

Real delivery dates and any applicable tax basis must be agreed by the parties. Local operation has no separate hosting subscription. Existing hardware, Internet access and Zoom account terms are independent. No service or paid driver is booked by the project code.

Source, configuration, launchers and assets are handed over for recipient use and further development. Any separately agreed exclusive rights must apply only where rights exist and are legally transferable; third-party component rights remain unaffected.
