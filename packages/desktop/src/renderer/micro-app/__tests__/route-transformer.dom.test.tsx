import { describe, it, expect } from 'vitest';
import { transformMenuToRoute, type BackendMenuItem } from '../router/route-transformer';

describe('transformMenuToRoute', () => {
  it('transforms internal menu to internal route', () => {
    const item: BackendMenuItem = {
      id: 'conv',
      titleKey: 'menu.conversation',
      path: '/conversation',
      type: 'internal',
      order: 1,
    };
    const route = transformMenuToRoute(item);
    expect(route.path).toBe('/conversation');
    expect(route.handle).toEqual(expect.objectContaining({ isMicroApp: false }));
  });

  it('transforms microApp menu using path first segment as activeRule', () => {
    const item: BackendMenuItem = {
      id: 'mr',
      titleKey: 'menu.meetingRecording',
      path: '/meeting-recording/list',
      type: 'microApp',
      microAppName: 'meeting-recording',
      order: 1,
    };
    const route = transformMenuToRoute(item);
    expect(route.path).toBe('/meeting-recording');
    expect(route.handle).toEqual(expect.objectContaining({ isMicroApp: true, microAppName: 'meeting-recording' }));
  });

  it('uses explicit activeRule when provided', () => {
    const item: BackendMenuItem = {
      id: 'mr',
      titleKey: 'menu.meetingRecording',
      path: '/m/rec',
      activeRule: '/meeting-recording',
      type: 'microApp',
      microAppName: 'meeting-recording',
      order: 1,
    };
    const route = transformMenuToRoute(item);
    expect(route.path).toBe('/meeting-recording');
  });

  it('throws when microApp menu missing microAppName', () => {
    const item: BackendMenuItem = {
      id: 'mr',
      titleKey: 'menu.meetingRecording',
      path: '/meeting-recording',
      type: 'microApp',
      order: 1,
    };
    expect(() => transformMenuToRoute(item)).toThrow(/microAppName/);
  });
});
