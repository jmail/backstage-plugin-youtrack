/**
 * A Backstage frontend plugin that shows YouTrack issues for catalog
 * entities.
 *
 * @packageDocumentation
 */

export {
  youtrackPlugin,
  EntityYouTrackCard,
  EntityYouTrackContent,
} from './plugin';
export {
  isYouTrackAvailable,
  getYouTrackSelector,
  type YouTrackSelector,
} from './annotations';
export {
  youtrackApiRef,
  YouTrackClient,
  YouTrackApiError,
  buildYouTrackQuery,
  getCustomFieldValue,
  ISSUE_FIELDS,
  type YouTrackApi,
  type YouTrackIssue,
  type YouTrackCustomField,
  type YouTrackCustomFieldValue,
  type ListIssuesOptions,
} from './api';
export {
  YOUTRACK_TAG_ANNOTATION,
  YOUTRACK_QUERY_ANNOTATION,
  DEFAULT_PROXY_PATH,
  DEFAULT_STATE_FIELD_NAMES,
  DEFAULT_ASSIGNEE_FIELD_NAMES,
} from './constants';
