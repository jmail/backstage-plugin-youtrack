import {
  ConfigApi,
  DiscoveryApi,
  FetchApi,
  createApiRef,
} from '@backstage/core-plugin-api';
import { YouTrackSelector } from './annotations';
import {
  DEFAULT_ASSIGNEE_FIELD_NAMES,
  DEFAULT_PROXY_PATH,
  DEFAULT_STATE_FIELD_NAMES,
} from './constants';

/** Fields requested from the YouTrack issues API. */
export const ISSUE_FIELDS =
  'idReadable,summary,resolved,updated,project(shortName),customFields(name,value(name))';

/** A single value of a YouTrack custom field. */
export interface YouTrackCustomFieldValue {
  name?: string;
}

/** A custom field of a YouTrack issue as returned by the REST API. */
export interface YouTrackCustomField {
  name: string;
  value:
    | YouTrackCustomFieldValue
    | YouTrackCustomFieldValue[]
    | null;
}

/** A YouTrack issue as returned by the REST API. */
export interface YouTrackIssue {
  idReadable: string;
  summary: string;
  /** Resolution timestamp in epoch milliseconds, or null when unresolved. */
  resolved: number | null;
  /** Last update timestamp in epoch milliseconds. */
  updated: number;
  project?: { shortName?: string };
  customFields?: YouTrackCustomField[];
}

/**
 * Builds a YouTrack search query for the given selector.
 *
 * Tag values often contain `:` or `.` (e.g. `svc:my-service`) and therefore
 * MUST be wrapped in braces: `tag: {svc:my-service}`.
 */
export function buildYouTrackQuery(
  selector: YouTrackSelector,
  options: { unresolvedOnly?: boolean } = {},
): string {
  const base =
    selector.type === 'query' ? selector.query : `tag: {${selector.tag}}`;
  const parts = [base];
  if (options.unresolvedOnly && !/#unresolved\b/i.test(base)) {
    parts.push('#Unresolved');
  }
  if (!/sort by:/i.test(base)) {
    parts.push('sort by: updated desc');
  }
  return parts.join(' ');
}

/**
 * Extracts a display value for the first matching custom field. Field name
 * matching is case-insensitive and the value may be a single object, an
 * array (multi-value fields) or null.
 */
export function getCustomFieldValue(
  issue: YouTrackIssue,
  candidateNames: string[],
): string | undefined {
  const fields = issue.customFields ?? [];
  for (const candidate of candidateNames) {
    const field = fields.find(
      f => f.name.toLowerCase() === candidate.toLowerCase(),
    );
    if (!field || field.value === null || field.value === undefined) {
      continue;
    }
    if (Array.isArray(field.value)) {
      const names = field.value
        .map(v => v?.name)
        .filter((n): n is string => Boolean(n));
      if (names.length > 0) {
        return names.join(', ');
      }
      continue;
    }
    if (field.value.name) {
      return field.value.name;
    }
  }
  return undefined;
}

/**
 * Error thrown by {@link YouTrackClient} with an HTTP status and a hint that
 * helps the user fix the most common misconfigurations.
 */
export class YouTrackApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'YouTrackApiError';
  }
}

/** Options accepted by {@link YouTrackApi.listIssues}. */
export interface ListIssuesOptions {
  /** Full YouTrack search query, see {@link buildYouTrackQuery}. */
  query: string;
  /** Maximum number of issues to return. */
  top: number;
  /** Number of issues to skip (pagination). */
  skip?: number;
}

/** API for fetching YouTrack issues through the Backstage proxy. */
export interface YouTrackApi {
  listIssues(options: ListIssuesOptions): Promise<YouTrackIssue[]>;
  /** Web UI link to a single issue. */
  getIssueUrl(issueId: string): string;
  /** Web UI link to the issue list filtered by the given query. */
  getQueryUrl(query: string): string;
  /** Candidate names of the state custom field (configurable). */
  getStateFieldNames(): string[];
  /** Candidate names of the assignee custom field (configurable). */
  getAssigneeFieldNames(): string[];
}

/** ApiRef for the {@link YouTrackApi}. */
export const youtrackApiRef = createApiRef<YouTrackApi>({
  id: 'plugin.youtrack.service',
});

/**
 * Default {@link YouTrackApi} implementation. Talks to YouTrack exclusively
 * through the Backstage proxy so that the permanent token stays server-side.
 */
export class YouTrackClient implements YouTrackApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly configApi: ConfigApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    configApi: ConfigApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.configApi = options.configApi;
  }

  private getWebBaseUrl(): string {
    const baseUrl = this.configApi.getOptionalString('youtrack.baseUrl');
    if (!baseUrl) {
      throw new Error(
        'Missing required config value: youtrack.baseUrl. Set it to the base URL of your YouTrack web UI, e.g. https://example.youtrack.cloud',
      );
    }
    return baseUrl.replace(/\/+$/, '');
  }

  private getProxyPath(): string {
    const proxyPath =
      this.configApi.getOptionalString('youtrack.proxyPath') ??
      DEFAULT_PROXY_PATH;
    return proxyPath.startsWith('/') ? proxyPath : `/${proxyPath}`;
  }

  getStateFieldNames(): string[] {
    return (
      this.configApi.getOptionalStringArray('youtrack.customFields.state') ??
      DEFAULT_STATE_FIELD_NAMES
    );
  }

  getAssigneeFieldNames(): string[] {
    return (
      this.configApi.getOptionalStringArray(
        'youtrack.customFields.assignee',
      ) ?? DEFAULT_ASSIGNEE_FIELD_NAMES
    );
  }

  getIssueUrl(issueId: string): string {
    return `${this.getWebBaseUrl()}/issue/${encodeURIComponent(issueId)}`;
  }

  getQueryUrl(query: string): string {
    return `${this.getWebBaseUrl()}/issues?q=${encodeURIComponent(query)}`;
  }

  async listIssues(options: ListIssuesOptions): Promise<YouTrackIssue[]> {
    const proxyBaseUrl = await this.discoveryApi.getBaseUrl('proxy');
    // The whole query is encoded with encodeURIComponent on purpose:
    // URLSearchParams would encode spaces as `+`, which is ambiguous once the
    // request passes through http-proxy-middleware.
    const params = [
      `fields=${encodeURIComponent(ISSUE_FIELDS)}`,
      `query=${encodeURIComponent(options.query)}`,
      `$top=${options.top}`,
      `$skip=${options.skip ?? 0}`,
    ].join('&');
    const url = `${proxyBaseUrl}${this.getProxyPath()}/issues?${params}`;

    const response = await this.fetchApi.fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw await this.toError(response);
    }
    return (await response.json()) as YouTrackIssue[];
  }

  private async toError(response: Response): Promise<YouTrackApiError> {
    let body = '';
    try {
      body = await response.text();
    } catch {
      // ignore — the status code alone is enough to build the error
    }
    let description: string | undefined;
    try {
      const parsed = JSON.parse(body);
      description = parsed?.error_description ?? parsed?.error?.message;
    } catch {
      // not JSON — fall through
    }

    const status = response.status;
    let hint: string | undefined;
    if (status === 404) {
      hint = `The Backstage proxy endpoint '${this.getProxyPath()}' was not found. Add it under proxy.endpoints in your app-config.`;
    } else if (status === 401) {
      const backstageAuth =
        /AuthenticationError|Missing credentials|cookie/i.test(body);
      hint = backstageAuth
        ? 'The Backstage proxy rejected the request before it reached YouTrack (missing Backstage credentials). Make sure requests go through fetchApi and check the proxy endpoint credentials setting.'
        : 'YouTrack rejected the token. Check the YOUTRACK_TOKEN used in the proxy Authorization header.';
    } else if (status === 403) {
      hint =
        'The YouTrack token does not have permission to read these issues.';
    } else if (status === 400) {
      hint =
        'YouTrack rejected the search query. Check the youtrack.com/query annotation or the tag value for invalid syntax.';
    }

    const suffix = description ? `: ${description}` : '';
    return new YouTrackApiError(
      `YouTrack request failed with status ${status}${suffix}`,
      status,
      hint,
    );
  }
}
