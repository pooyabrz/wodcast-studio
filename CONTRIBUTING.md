# Contributing

Keep code, interface strings, comments, documentation, commit messages and pull requests in English. Use readable JavaScript modules and built-in browser/Node APIs where practical.

## Before a pull request

```sh
npm run verify
```

When changing the interface, run the optional browser smoke checks if a browser is available and report any verification limit. Timer changes need behavior tests covering pause/resume and phase boundaries. Streaming changes need a documented receiving-device test.

Keep user-provided content as text nodes. Add new configuration fields to the explicit schema before using them in a form. Regenerate `WODCAST-Preview.html` after changing interface code or assets.

Describe the user-visible problem, resulting behavior and checks run. Do not commit local data, secrets, downloaded packages or private workout content.
