import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { handlers } from '../../mocks';
import { YouTrackIssuesContent } from './YouTrackIssuesContent';

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

const renderContent = (entity: Entity, pageSize?: number) =>
  renderInTestApp(
    <TestApiProvider apis={[[youtrackApiRef, client]]}>
      <EntityProvider entity={entity}>
        <YouTrackIssuesContent pageSize={pageSize} />
      </EntityProvider>
    </TestApiProvider>,
  );

describe('YouTrackIssuesContent', () => {
  it('renders unresolved issues with state and assignee columns', async () => {
    await renderContent(entityWith({ 'youtrack.com/tag': 'svc:example' }));

    await screen.findByText('DEMO-101');
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Alice Doe')).toBeInTheDocument();
    // localized field names resolved through the candidate list
    expect(screen.getByText('W trakcie')).toBeInTheDocument();
    expect(screen.getByText('Celina Kowalska')).toBeInTheDocument();
    // resolved issues hidden by default
    expect(screen.queryByText('DEMO-103')).toBeNull();
    expect(screen.getByText(/YouTrack issues \(5\)/)).toBeInTheDocument();
  });

  it('shows resolved issues after switching the toggle off', async () => {
    await renderContent(entityWith({ 'youtrack.com/tag': 'svc:example' }));
    await screen.findByText('DEMO-101');

    await userEvent.click(
      screen.getByRole('checkbox', { name: /unresolved only/i }),
    );

    await screen.findByText('DEMO-103');
    expect(screen.getByText('OPS-8')).toBeInTheDocument();
  });

  it('loads further pages via the Load more button', async () => {
    await renderContent(
      entityWith({ 'youtrack.com/tag': 'svc:example' }),
      2,
    );

    await screen.findByText('OPS-7');
    expect(screen.queryByText('DEMO-102')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await screen.findByText('DEMO-102');
    expect(screen.getByText('DEMO-104')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await screen.findByText('DEMO-106');
    // the last page was shorter than pageSize — no more issues to load
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('renders a readable error panel for invalid queries', async () => {
    await renderContent(
      entityWith({ 'youtrack.com/query': 'tag: {unbalanced' }),
    );

    await screen.findByText(/Failed to load YouTrack issues/);
    expect(screen.getByText(/Invalid query/)).toBeInTheDocument();
  });

  it('asks for an annotation when none is present', async () => {
    await renderContent(entityWith(undefined));
    expect(screen.getByText(/missing annotation/i)).toBeInTheDocument();
  });
});
