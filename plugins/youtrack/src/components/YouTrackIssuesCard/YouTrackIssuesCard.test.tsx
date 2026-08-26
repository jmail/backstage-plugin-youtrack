import { screen } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import {
  MockFetchApi,
  TestApiProvider,
  mockApis,
  registerMswTestHooks,
  renderInTestApp,
} from '@backstage/test-utils';
import { setupServer } from 'msw/node';

import { YouTrackClient, youtrackApiRef } from '../../api';
import { createYouTrackErrorHandler, handlers } from '../../mocks';
import { YouTrackIssuesCard } from './YouTrackIssuesCard';

const server = setupServer(...handlers);
registerMswTestHooks(server);

const client = new YouTrackClient({
  discoveryApi: {
    getBaseUrl: async (pluginId: string) =>
      `http://localhost:7007/api/${pluginId}`,
  },
  fetchApi: new MockFetchApi(),
  configApi: mockApis.config({
    data: { youtrack: { baseUrl: 'https://yt.example.com' } },
  }),
});

const entityWith = (annotations?: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'example', annotations },
});

const renderCard = (entity: Entity) =>
  renderInTestApp(
    <TestApiProvider apis={[[youtrackApiRef, client]]}>
      <EntityProvider entity={entity}>
        <YouTrackIssuesCard />
      </EntityProvider>
    </TestApiProvider>,
  );

describe('YouTrackIssuesCard', () => {
  it('renders the most recent unresolved issues with a deep link', async () => {
    await renderCard(entityWith({ 'youtrack.com/tag': 'svc:example' }));

    await screen.findByText('DEMO-101');
    expect(screen.getByText('OPS-7')).toBeInTheDocument();
    // resolved issues stay hidden on the card
    expect(screen.queryByText('DEMO-103')).toBeNull();
    // issues of other services are filtered out by the tag
    expect(screen.queryByText('DEMO-105')).toBeNull();

    const deepLink = screen.getByText('Open in YouTrack').closest('a');
    expect(deepLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://yt.example.com/issues?q='),
    );
  });

  it('renders an empty state when there are no open issues', async () => {
    await renderCard(entityWith({ 'youtrack.com/tag': 'svc:no-such-tag' }));
    expect(
      await screen.findByText(/No open issues found/),
    ).toBeInTheDocument();
  });

  it('renders a readable error panel with a hint on 401', async () => {
    server.use(createYouTrackErrorHandler(401, { error: 'Unauthorized' }));
    await renderCard(entityWith({ 'youtrack.com/tag': 'svc:example' }));

    await screen.findByText(/Failed to load YouTrack issues/);
    expect(screen.getByText(/YOUTRACK_TOKEN/)).toBeInTheDocument();
  });

  it('asks for an annotation when none is present', async () => {
    await renderCard(entityWith(undefined));
    expect(screen.getByText(/missing annotation/i)).toBeInTheDocument();
  });
});
