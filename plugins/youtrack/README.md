# @jmail/backstage-plugin-youtrack

A [Backstage](https://backstage.io) frontend plugin that shows [YouTrack](https://www.jetbrains.com/youtrack/) issues on catalog entity pages — the YouTrack counterpart of the Jira entity plugins.

- **`EntityYouTrackCard`** — compact Overview card with the most recently updated unresolved issues and an *Open in YouTrack* deep link.
- **`EntityYouTrackContent`** — full entity tab with a searchable table (ID / summary / state / assignee / updated), an *Unresolved only* switch and incremental loading (*Load more*).
- **Frontend-only.** YouTrack is called exclusively through the built-in Backstage proxy — your permanent token lives server-side and never reaches the browser.
- **Generic.** Annotation keys, custom field names and the proxy path are configurable; no organization-specific assumptions.

Screenshots: see the [repository README](https://github.com/jmail/backstage-plugin-youtrack#screenshots).

## Installation

```sh
yarn --cwd packages/app add @jmail/backstage-plugin-youtrack
```

### 1. Configure the proxy

In `app-config.yaml`:

```yaml
proxy:
  endpoints:
    '/youtrack':
      target: https://your-instance.youtrack.cloud/api
      credentials: require # default since Backstage 1.28
      allowedMethods: ['GET']
      headers:
        Authorization: Bearer ${YOUTRACK_TOKEN}
        Accept: application/json
```

Set the `YOUTRACK_TOKEN` environment variable to a YouTrack permanent token (`perm:...`) that can read the relevant issues.

### 2. Configure the plugin

```yaml
youtrack:
  # REQUIRED: base URL of the YouTrack *web UI*, used to build links
  baseUrl: https://your-instance.youtrack.cloud
  # optional, defaults shown:
  proxyPath: /youtrack
  customFields:
    state: [State, Stan]
    assignee: [Assignee, Wykonawca]
```

`customFields` exists because the *State*/*Assignee* custom field names are defined per YouTrack project and are often localized. Each entry is a list of candidate names — the first field present on an issue wins.

### 3. Annotate your entities

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    # issues are selected by this YouTrack tag...
    youtrack.com/tag: svc:my-service
    # ...or by a raw YouTrack search query (wins when both are present)
    # youtrack.com/query: 'project: DEMO #{My subsystem}'
```

Tag values may freely contain `:` or `.` — the plugin wraps them in braces (`tag: {svc:my-service}`) as required by the YouTrack query syntax.

### 4. Wire up the entity page

In `packages/app/src/components/catalog/EntityPage.tsx`:

```diff
+import {
+  EntityYouTrackCard,
+  EntityYouTrackContent,
+  isYouTrackAvailable,
+} from '@jmail/backstage-plugin-youtrack';

 const overviewContent = (
   <Grid container spacing={3} alignItems="stretch">
     {entityWarningContent}
     <Grid item md={6}>
       <EntityAboutCard variant="gridItem" />
     </Grid>
+    <Grid item md={6}>
+      <EntityYouTrackCard />
+    </Grid>
     ...
   </Grid>
 );

 const serviceEntityPage = (
   <EntityLayout>
     <EntityLayout.Route path="/" title="Overview">
       {overviewContent}
     </EntityLayout.Route>
+    <EntityLayout.Route
+      path="/youtrack"
+      title="YouTrack"
+      if={isYouTrackAvailable}
+    >
+      <EntityYouTrackContent />
+    </EntityLayout.Route>
     ...
   </EntityLayout>
 );
```

Entities without a YouTrack annotation don't get the tab (`if={isYouTrackAvailable}`); the card shows a *missing annotation* empty state.

## Exports

| Export | Description |
| --- | --- |
| `EntityYouTrackCard` | Overview card (props: `title`, `maxItems`, `variant`) |
| `EntityYouTrackContent` | Entity tab (props: `pageSize`) |
| `isYouTrackAvailable` | Predicate for `EntityLayout.Route if` / `EntitySwitch.Case` |
| `getYouTrackSelector` | Resolves the tag/query selector from an entity |
| `youtrackApiRef`, `YouTrackApi`, `YouTrackClient` | Frontend API (replaceable via `ApiFactory`) |
| `buildYouTrackQuery`, `getCustomFieldValue` | Pure helpers (query building, custom field parsing) |
| `YOUTRACK_TAG_ANNOTATION`, `YOUTRACK_QUERY_ANNOTATION` | Annotation keys |

## Troubleshooting

**401 — two different flavors.** The error panel distinguishes them:

- *"The Backstage proxy rejected the request before it reached YouTrack"* — the Backstage backend rejected the call (endpoint has `credentials: require` and the request carried no Backstage user credentials). The plugin always calls through `fetchApi`, so this usually means the user is not signed in, e.g. a guest-access setup. Either sign in or relax the endpoint to `credentials: dangerously-allow-unauthenticated`.
- *"YouTrack rejected the token"* — the request reached YouTrack but `YOUTRACK_TOKEN` is missing, expired or lacks permissions. Verify the token with `curl -H "Authorization: Bearer perm:..." https://your-instance.youtrack.cloud/api/issues?query=me:%20me`.

**404** — the proxy endpoint path in `app-config.yaml` doesn't match `youtrack.proxyPath` (default `/youtrack`).

**400 Invalid query** — the `youtrack.com/query` annotation contains invalid YouTrack search syntax (e.g. unbalanced braces). Tag annotations are wrapped in braces automatically; raw queries are passed through as-is. The plugin encodes the whole query with `encodeURIComponent`, so spaces, `#` and `{}` survive the proxy unchanged.

**Empty list although YouTrack shows issues** — check that the tag value in the annotation matches the YouTrack tag exactly, and that the token's user can see those issues.

## Compatibility

Built and tested against Backstage **1.53.0** (classic frontend system, `@material-ui` v4). The plugin only uses long-stable classic APIs (`createPlugin`, `createRoutableExtension`, `EntityLayout.Route if`), so it is expected to work on a wide range of recent Backstage versions.

## License

Apache-2.0
