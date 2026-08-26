# backstage-plugin-youtrack

Monorepo for [`@jmails/backstage-plugin-youtrack`](./plugins/youtrack) — a Backstage frontend plugin that shows YouTrack issues on catalog entity pages (Overview card + full entity tab), talking to YouTrack exclusively through the Backstage proxy.

**➡ Full installation and configuration docs: [plugins/youtrack/README.md](./plugins/youtrack/README.md)**

## Screenshots

Captured from a scaffolded Backstage app running against the bundled mock (`mock-youtrack/`):

| Overview card (`EntityYouTrackCard`) | Issues tab (`EntityYouTrackContent`) |
| --- | --- |
| ![Overview card](./docs/overview-card.png) | ![Issues tab](./docs/issues-tab.png) |

## Repository layout

```
plugins/youtrack/   # the published package: @jmails/backstage-plugin-youtrack
mock-youtrack/      # dependency-free mock of the YouTrack REST API for interactive testing
.github/workflows/  # CI: typecheck + lint + test + build on PRs, npm publish on v* tags
```

## Development

Requirements: Node 24 (see `.nvmrc`; Node 22 works too), Yarn 4 via corepack.

```sh
yarn install
yarn tsc        # typecheck
yarn test       # jest + React Testing Library + msw (no live YouTrack needed)
yarn build      # backstage-cli package build
```

### Interactive testing without a YouTrack instance

1. Start the mock API: `node mock-youtrack/server.mjs` (listens on `:8090`, serves `GET /api/issues`, asserts a `Bearer` header, honors `query`/`#Unresolved`/`$top`/`$skip`).
2. Scaffold a Backstage app next to this repo: `npx @backstage/create-app@latest --legacy` (the plugin targets the classic frontend system).
3. Pack the plugin and add the tarball to the app (a `portal:`/`link:` dependency would pull in a
   second copy of React from this repo's `node_modules` — the tarball also matches what npm ships):

   ```sh
   yarn --cwd plugins/youtrack pack --out ../../../my-app/plugin-youtrack.tgz
   # in packages/app/package.json of the scaffolded app:
   #   "@jmails/backstage-plugin-youtrack": "file:../../plugin-youtrack.tgz"
   yarn install
   ```
4. Point the proxy at the mock in `app-config.yaml`:

   ```yaml
   proxy:
     endpoints:
       '/youtrack':
         target: http://localhost:8090/api
         credentials: dangerously-allow-unauthenticated # guest dev app
         allowedMethods: ['GET']
         headers:
           Authorization: Bearer perm:dummy
   youtrack:
     baseUrl: https://example.youtrack.cloud
   ```

5. Wire `EntityYouTrackCard` / `EntityYouTrackContent` into `EntityPage.tsx` (see the plugin README), annotate an example entity with `youtrack.com/tag: svc:example`, and `yarn start`.

There is also a standalone dev app backed by an in-memory fake (no backend/proxy): `yarn --cwd plugins/youtrack start`.

## Releasing

CI publishes `@jmails/backstage-plugin-youtrack` to npm on every `v*` tag via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC) — no long-lived token is stored in the repository. The trusted publisher is configured once on npmjs.com (package → Settings → Trusted Publisher → GitHub Actions: `jmail/backstage-plugin-youtrack`, workflow `ci.yml`); provenance attestations are generated automatically. Release = bump `version` in `plugins/youtrack/package.json`, commit, `git tag vX.Y.Z && git push origin vX.Y.Z`. Local dry-run of the package contents: `yarn --cwd plugins/youtrack pack --dry-run`.

## License

Apache-2.0
