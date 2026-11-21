# Put the project on GitHub

Suggested repository name: **wodcast-studio**.

Suggested description:

> Local-first HTML5 workout studio with a transparent OBS overlay, shared timers, custom branding and private-network phone control.

Suggested topics: `html5`, `javascript`, `nodejs`, `obs`, `streaming`, `workout`, `timer`.

## Git command line

1. Create an empty repository in your GitHub account. Choose the visibility appropriate for your project. Leave automatic README/license creation off because these files are already included.
2. Extract the delivery ZIP and open a terminal inside the `wodcast-studio` folder.
3. Run:

```sh
git init -b main
git add .
git commit -m "Initial English release of WODCAST Studio"
git remote add origin https://github.com/YOUR_USERNAME/wodcast-studio.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub account or organization. Authenticate using your normal GitHub Git setup. No access token is included in this delivery.

## GitHub Desktop

Create a repository from the extracted folder, review the files, create the initial commit and publish it to the chosen account. Include the `.github` directory so workflows and issue/PR templates are available.

## Verify after upload

The **Continuous integration** workflow runs on pushes to `main` and pull requests. It checks Node 22/24 across Linux, Windows and macOS. The matrix is configured, but has not been run on GitHub as part of this delivery.

Run **Optional browser QA** manually from the Actions tab when ready. It installs Playwright/Chromium in the hosted runner and exercises the interface. This workflow is separate because browser execution was blocked in the delivery environment.

## Hosting

GitHub stores the source. Running the complete studio still requires `npm start` on the streaming computer or another suitable private Node host. GitHub Pages does not execute the Node server or its SSE endpoints. The standalone HTML preview can be served as a static demo if you choose to configure Pages later.

## Files to keep out of Git

The supplied ignore rules cover runtime `data/`, installed packages, local environment files, logs and test artifacts. Keep user logos, session notes and exported private layout files outside committed source unless intentionally shared. The three example layouts use fictional sample content.
