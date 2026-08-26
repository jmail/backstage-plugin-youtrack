import plugin, {
  youtrackApi,
  youtrackIssuesCard,
  youtrackIssuesContent,
} from './alpha';

describe('new frontend system entry point', () => {
  it('exports a frontend plugin with the expected id', () => {
    expect(plugin.id).toBe('youtrack');
    expect((plugin as any).$$type).toBe('@backstage/FrontendPlugin');
  });

  it('defines the api, card and content extensions', () => {
    for (const ext of [youtrackApi, youtrackIssuesCard, youtrackIssuesContent]) {
      expect((ext as any).$$type).toBe('@backstage/ExtensionDefinition');
    }
    expect(plugin.getExtension('api:youtrack/youtrack')).toBeDefined();
    expect(plugin.getExtension('entity-card:youtrack/issues')).toBeDefined();
    expect(plugin.getExtension('entity-content:youtrack/issues')).toBeDefined();
  });
});
