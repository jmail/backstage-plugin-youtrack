import { Entity } from '@backstage/catalog-model';
import {
  YOUTRACK_QUERY_ANNOTATION,
  YOUTRACK_TAG_ANNOTATION,
} from './constants';

/**
 * Describes how issues are selected for an entity: either by a YouTrack tag
 * or by a raw YouTrack search query.
 */
export type YouTrackSelector =
  | { type: 'tag'; tag: string }
  | { type: 'query'; query: string };

/**
 * Resolves the YouTrack issue selector from the entity's annotations.
 * A `youtrack.com/query` annotation wins over `youtrack.com/tag`.
 */
export function getYouTrackSelector(
  entity: Entity,
): YouTrackSelector | undefined {
  const annotations = entity.metadata.annotations ?? {};
  const query = annotations[YOUTRACK_QUERY_ANNOTATION]?.trim();
  if (query) {
    return { type: 'query', query };
  }
  const tag = annotations[YOUTRACK_TAG_ANNOTATION]?.trim();
  if (tag) {
    return { type: 'tag', tag };
  }
  return undefined;
}

/**
 * Returns true when the entity carries any of the YouTrack annotations.
 * Intended for `EntityLayout.Route if={...}` and `EntitySwitch.Case`.
 */
export function isYouTrackAvailable(entity: Entity): boolean {
  return Boolean(getYouTrackSelector(entity));
}
