/**
 * Entry point for the new Backstage frontend system (`createApp` from
 * `@backstage/frontend-defaults`). Import it as
 * `@jmails/backstage-plugin-youtrack/alpha` and add the default export to the
 * app's `features`. The classic entry point (`@jmails/backstage-plugin-youtrack`)
 * keeps working for apps built with `@backstage/app-defaults`.
 *
 * @packageDocumentation
 */
import {
  ApiBlueprint,
  configApiRef,
  createApiFactory,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';

import { isYouTrackAvailable } from './annotations';
import { YouTrackClient, youtrackApiRef } from './api';

/** @alpha */
export const youtrackApi = ApiBlueprint.make({
  name: 'youtrack',
  params: defineParams =>
    defineParams(
      createApiFactory({
        api: youtrackApiRef,
        deps: {
          discoveryApi: discoveryApiRef,
          fetchApi: fetchApiRef,
          configApi: configApiRef,
        },
        factory: ({ discoveryApi, fetchApi, configApi }) =>
          new YouTrackClient({ discoveryApi, fetchApi, configApi }),
      }),
    ),
});

/**
 * Overview card with the most recently updated unresolved issues.
 * Only shown for entities carrying a YouTrack annotation
 * (override the filter via `app.extensions` in app-config if needed).
 *
 * @alpha
 */
export const youtrackIssuesCard = EntityCardBlueprint.make({
  name: 'issues',
  params: {
    type: 'content',
    filter: isYouTrackAvailable,
    loader: () =>
      import('./components/YouTrackIssuesCard').then(m => (
        <m.YouTrackIssuesCard />
      )),
  },
});

/**
 * "YouTrack" tab with the searchable issue table.
 *
 * @alpha
 */
export const youtrackIssuesContent = EntityContentBlueprint.make({
  name: 'issues',
  params: {
    path: '/youtrack',
    title: 'YouTrack',
    filter: isYouTrackAvailable,
    loader: () =>
      import('./components/YouTrackIssuesContent').then(m => (
        <m.YouTrackIssuesContent />
      )),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'youtrack',
  info: { packageJson: () => import('../package.json') },
  extensions: [youtrackApi, youtrackIssuesCard, youtrackIssuesContent],
});
