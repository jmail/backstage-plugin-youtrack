/**
 * Entity annotation holding the name of a YouTrack tag that marks the
 * entity's issues, e.g. `svc:my-service`.
 */
export const YOUTRACK_TAG_ANNOTATION = 'youtrack.com/tag';

/**
 * Entity annotation holding a raw YouTrack search query. When present it
 * takes precedence over {@link YOUTRACK_TAG_ANNOTATION}.
 */
export const YOUTRACK_QUERY_ANNOTATION = 'youtrack.com/query';

/** Default Backstage proxy endpoint path targeting the YouTrack REST API. */
export const DEFAULT_PROXY_PATH = '/youtrack';

/** Default candidate names of the issue state custom field. */
export const DEFAULT_STATE_FIELD_NAMES = ['State', 'Stan'];

/** Default candidate names of the assignee custom field. */
export const DEFAULT_ASSIGNEE_FIELD_NAMES = ['Assignee', 'Wykonawca'];
