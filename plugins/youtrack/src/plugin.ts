import {
  configApiRef,
  createApiFactory,
  createComponentExtension,
  createPlugin,
  createRoutableExtension,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { YouTrackClient, youtrackApiRef } from './api';
import { rootRouteRef } from './routes';

/** The YouTrack frontend plugin. */
export const youtrackPlugin = createPlugin({
  id: 'youtrack',
  apis: [
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
  ],
  routes: {
    root: rootRouteRef,
  },
});

/**
 * Compact card for the entity Overview page: the most recently updated
 * unresolved issues plus a deep link to YouTrack.
 */
export const EntityYouTrackCard = youtrackPlugin.provide(
  createComponentExtension({
    name: 'EntityYouTrackCard',
    component: {
      lazy: () =>
        import('./components/YouTrackIssuesCard').then(
          m => m.YouTrackIssuesCard,
        ),
    },
  }),
);

/**
 * Full-page entity tab with a searchable table of YouTrack issues,
 * an unresolved/all switch and incremental loading.
 */
export const EntityYouTrackContent = youtrackPlugin.provide(
  createRoutableExtension({
    name: 'EntityYouTrackContent',
    component: () =>
      import('./components/YouTrackIssuesContent').then(
        m => m.YouTrackIssuesContent,
      ),
    mountPoint: rootRouteRef,
  }),
);
