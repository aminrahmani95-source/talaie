import { describe, expect, it } from 'vitest';
import { movePhotoBetweenGroups } from './photoGroups';

describe('movePhotoBetweenGroups', () => {
  const project = { beforePhotos: ['a', 'AFTER-1', 'b'], afterPhotos: ['c'], completionPhotos: [] };

  it('moves a photo put in the wrong section, saving both lists together', () => {
    expect(movePhotoBetweenGroups(project, 'beforePhotos', 1, 'afterPhotos')).toEqual({
      beforePhotos: ['a', 'b'],
      afterPhotos: ['c', 'AFTER-1'],
    });
    // the original project is not changed
    expect(project.beforePhotos).toEqual(['a', 'AFTER-1', 'b']);
  });

  it('works when the target section is empty', () => {
    expect(movePhotoBetweenGroups({ beforePhotos: [], afterPhotos: ['x'] }, 'afterPhotos', 0, 'beforePhotos')).toEqual({
      afterPhotos: [],
      beforePhotos: ['x'],
    });
  });

  it('never duplicates and refuses impossible moves', () => {
    expect(movePhotoBetweenGroups({ beforePhotos: ['x'], afterPhotos: ['x'] }, 'beforePhotos', 0, 'afterPhotos')).toEqual({
      beforePhotos: [],
      afterPhotos: ['x'],
    });
    expect(movePhotoBetweenGroups(project, 'beforePhotos', 9, 'afterPhotos')).toBeNull();
    expect(movePhotoBetweenGroups(project, 'beforePhotos', 0, 'beforePhotos')).toBeNull();
  });
});
