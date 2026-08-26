import { MockFetchApi, mockApis, registerMswTestHooks } from '@backstage/test-utils';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

import {
  ISSUE_FIELDS,
  YouTrackApiError,
  YouTrackClient,
  buildYouTrackQuery,
  getCustomFieldValue,
} from './api';
import {
  createYouTrackErrorHandler,
  handlers,
  mockIssues,
} from './mocks';

describe('buildYouTrackQuery', () => {
  it('wraps tag values in braces and sorts by update time', () => {
    expect(buildYouTrackQuery({ type: 'tag', tag: 'svc:my-service' })).toBe(
      'tag: {svc:my-service} sort by: updated desc',
    );
  });

  it('adds #Unresolved when requested', () => {
    expect(
      buildYouTrackQuery(
        { type: 'tag', tag: 'svc:x' },
        { unresolvedOnly: true },
      ),
    ).toBe('tag: {svc:x} #Unresolved sort by: updated desc');
  });

  it('passes custom queries through', () => {
    expect(
      buildYouTrackQuery(
        { type: 'query', query: 'project: DEMO assignee: me' },
        { unresolvedOnly: true },
      ),
    ).toBe('project: DEMO assignee: me #Unresolved sort by: updated desc');
  });

  it('does not duplicate #Unresolved in custom queries', () => {
    expect(
      buildYouTrackQuery(
        { type: 'query', query: 'project: DEMO #unresolved' },
        { unresolvedOnly: true },
      ),
    ).toBe('project: DEMO #unresolved sort by: updated desc');
  });

  it('does not override an explicit sort clause', () => {
    expect(
      buildYouTrackQuery({
        type: 'query',
        query: 'project: DEMO sort by: created asc',
      }),
    ).toBe('project: DEMO sort by: created asc');
  });
});

describe('getCustomFieldValue', () => {
  const issue = (customFields: any) => ({
    idReadable: 'X-1',
    summary: 'x',
    resolved: null,
    updated: 0,
    customFields,
  });

  it('reads single-value fields', () => {
    expect(
      getCustomFieldValue(
        issue([{ name: 'State', value: { name: 'Open' } }]),
        ['State'],
      ),
    ).toBe('Open');
  });

  it('joins multi-value fields', () => {
    expect(
      getCustomFieldValue(
        issue([
          { name: 'Assignee', value: [{ name: 'Alice' }, { name: 'Bob' }] },
        ]),
        ['Assignee'],
      ),
    ).toBe('Alice, Bob');
  });

  it('skips null values and falls through candidate names', () => {
    expect(
      getCustomFieldValue(
        issue([
          { name: 'State', value: null },
          { name: 'Stan', value: { name: 'W trakcie' } },
        ]),
        ['State', 'Stan'],
      ),
    ).toBe('W trakcie');
  });

  it('matches field names case-insensitively', () => {
    expect(
      getCustomFieldValue(
        issue([{ name: 'state', value: { name: 'Open' } }]),
        ['State'],
      ),
    ).toBe('Open');
  });

  it('returns undefined when nothing matches', () => {
    expect(getCustomFieldValue(issue([]), ['State', 'Stan'])).toBeUndefined();
    expect(
      getCustomFieldValue(issue(undefined), ['State']),
    ).toBeUndefined();
  });
});

describe('YouTrackClient', () => {
  const server = setupServer(...handlers);
  registerMswTestHooks(server);

  const discoveryApi = {
    getBaseUrl: async (pluginId: string) =>
      `http://localhost:7007/api/${pluginId}`,
  };
  const fetchApi = new MockFetchApi();

  const makeClient = (config: object = {}) =>
    new YouTrackClient({
      discoveryApi,
      fetchApi,
      configApi: mockApis.config({
        data: {
          youtrack: { baseUrl: 'https://yt.example.com/', ...config },
        },
      }),
    });

  it('fetches issues through the proxy', async () => {
    const client = makeClient();
    const issues = await client.listIssues({
      query: 'tag: {svc:example} #Unresolved sort by: updated desc',
      top: 50,
    });
    expect(issues.map(i => i.idReadable)).toEqual([
      'OPS-7',
      'DEMO-101',
      'DEMO-102',
      'DEMO-104',
      'DEMO-106',
    ]);
  });

  it('encodes the query with encodeURIComponent and passes paging params', async () => {
    let requestUrl: URL | undefined;
    server.use(
      rest.get('*/api/proxy/youtrack/issues', (req, res, ctx) => {
        requestUrl = new URL(req.url.toString());
        return res(ctx.json([]));
      }),
    );

    await makeClient().listIssues({
      query: 'tag: {svc:x} #Unresolved',
      top: 5,
      skip: 10,
    });

    expect(requestUrl).toBeDefined();
    // no `+`-for-space encoding — spaces must be %20
    expect(requestUrl!.search).toContain(
      'query=tag%3A%20%7Bsvc%3Ax%7D%20%23Unresolved',
    );
    expect(requestUrl!.searchParams.get('query')).toBe(
      'tag: {svc:x} #Unresolved',
    );
    expect(requestUrl!.searchParams.get('fields')).toBe(ISSUE_FIELDS);
    expect(requestUrl!.searchParams.get('$top')).toBe('5');
    expect(requestUrl!.searchParams.get('$skip')).toBe('10');
  });

  it('honors the youtrack.proxyPath config', async () => {
    let called = false;
    server.use(
      rest.get('*/api/proxy/yt-custom/issues', (_req, res, ctx) => {
        called = true;
        return res(ctx.json([]));
      }),
    );

    await makeClient({ proxyPath: '/yt-custom' }).listIssues({
      query: 'x',
      top: 1,
    });
    expect(called).toBe(true);
  });

  it('reports a YouTrack token problem on plain 401', async () => {
    server.use(createYouTrackErrorHandler(401, { error: 'Unauthorized' }));
    const err = await makeClient()
      .listIssues({ query: 'x', top: 1 })
      .catch(e => e);
    expect(err).toBeInstanceOf(YouTrackApiError);
    expect(err.status).toBe(401);
    expect(err.hint).toMatch(/YOUTRACK_TOKEN/);
  });

  it('reports a Backstage credentials problem on proxy 401', async () => {
    server.use(
      createYouTrackErrorHandler(401, {
        error: { name: 'AuthenticationError', message: 'Missing credentials' },
      }),
    );
    const err = await makeClient()
      .listIssues({ query: 'x', top: 1 })
      .catch(e => e);
    expect(err).toBeInstanceOf(YouTrackApiError);
    expect(err.hint).toMatch(/Backstage/);
    expect(err.message).toMatch(/Missing credentials/);
  });

  it('reports query syntax problems on 400', async () => {
    const err = await makeClient()
      .listIssues({ query: 'tag: {unbalanced', top: 1 })
      .catch(e => e);
    expect(err).toBeInstanceOf(YouTrackApiError);
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Invalid query/);
    expect(err.hint).toMatch(/query/i);
  });

  it('hints at proxy configuration on 404', async () => {
    server.use(createYouTrackErrorHandler(404, { error: 'NotFound' }));
    const err = await makeClient()
      .listIssues({ query: 'x', top: 1 })
      .catch(e => e);
    expect(err.hint).toMatch(/proxy/i);
  });

  it('builds web links from youtrack.baseUrl', () => {
    const client = makeClient();
    expect(client.getIssueUrl('DEMO-101')).toBe(
      'https://yt.example.com/issue/DEMO-101',
    );
    expect(client.getQueryUrl('tag: {svc:x}')).toBe(
      'https://yt.example.com/issues?q=tag%3A%20%7Bsvc%3Ax%7D',
    );
  });

  it('throws a readable error when youtrack.baseUrl is missing', () => {
    const client = new YouTrackClient({
      discoveryApi,
      fetchApi,
      configApi: mockApis.config({ data: {} }),
    });
    expect(() => client.getIssueUrl('DEMO-1')).toThrow(/youtrack\.baseUrl/);
  });

  it('exposes configurable custom field candidates with defaults', () => {
    expect(makeClient().getStateFieldNames()).toEqual(['State', 'Stan']);
    expect(
      makeClient({
        customFields: { state: ['Status'], assignee: ['Owner'] },
      }).getStateFieldNames(),
    ).toEqual(['Status']);
    expect(
      makeClient({
        customFields: { assignee: ['Owner'] },
      }).getAssigneeFieldNames(),
    ).toEqual(['Owner']);
  });

  it('keeps the fixture set aligned with the documented shape', () => {
    // guards against fixtures drifting away from the REST contract
    for (const issue of mockIssues) {
      expect(typeof issue.idReadable).toBe('string');
      expect(typeof issue.updated).toBe('number');
      expect(
        issue.resolved === null || typeof issue.resolved === 'number',
      ).toBe(true);
    }
  });
});
