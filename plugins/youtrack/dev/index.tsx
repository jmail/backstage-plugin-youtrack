import { Grid } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';
import { createApiFactory } from '@backstage/core-plugin-api';
import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';

import {
  ListIssuesOptions,
  YouTrackApi,
  YouTrackIssue,
  youtrackApiRef,
} from '../src/api';
import { queryMockIssues } from '../src/mocks';
import {
  EntityYouTrackCard,
  EntityYouTrackContent,
  youtrackPlugin,
} from '../src/plugin';

/*
 * Standalone dev app backed by an in-memory fake API (no proxy, no backend).
 * Run with `yarn start` inside plugins/youtrack. For an end-to-end check
 * through the real Backstage proxy, use a scaffolded app together with
 * `mock-youtrack/server.mjs` instead — see the repo README.
 */

const mockEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'example-service',
    annotations: {
      'youtrack.com/tag': 'svc:example',
    },
  },
};

class FakeYouTrackApi implements YouTrackApi {
  async listIssues(options: ListIssuesOptions): Promise<YouTrackIssue[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return queryMockIssues(options.query, {
      top: options.top,
      skip: options.skip,
    });
  }
  getIssueUrl(issueId: string): string {
    return `https://example.youtrack.cloud/issue/${encodeURIComponent(
      issueId,
    )}`;
  }
  getQueryUrl(query: string): string {
    return `https://example.youtrack.cloud/issues?q=${encodeURIComponent(
      query,
    )}`;
  }
  getStateFieldNames(): string[] {
    return ['State', 'Stan'];
  }
  getAssigneeFieldNames(): string[] {
    return ['Assignee', 'Wykonawca'];
  }
}

createDevApp()
  .registerPlugin(youtrackPlugin)
  .registerApi(
    createApiFactory({
      api: youtrackApiRef,
      deps: {},
      factory: () => new FakeYouTrackApi(),
    }),
  )
  .addPage({
    element: (
      <EntityProvider entity={mockEntity}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <EntityYouTrackCard />
          </Grid>
        </Grid>
      </EntityProvider>
    ),
    title: 'Overview card',
    path: '/youtrack-card',
  })
  .addPage({
    element: (
      <EntityProvider entity={mockEntity}>
        <EntityYouTrackContent />
      </EntityProvider>
    ),
    title: 'Issues tab',
    path: '/youtrack',
  })
  .render();
