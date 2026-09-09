export { default as SiderAssistantEntry } from './SiderAssistantEntry';
export { default as SiderKnowledgeEntry } from './SiderKnowledgeEntry';
export { default as SiderNoteEntry } from './SiderNoteEntry';
export { default as SiderScheduledEntry } from './SiderScheduledEntry';
export { default as SiderSearchEntry } from './SiderSearchEntry';
export { default as SiderToolbar } from './SiderToolbar';
export { default as SiderWorkbenchEntry } from './SiderWorkbenchEntry';
// Task Center sidebar entry is enterprise-only; the public flavor keeps the
// page/IPC code in the bundle but hides the entry from the UI. Driven by
// packages/desktop/src/common/config/flavor.ts.
import RealSiderTaskCenterEntry from './SiderTaskCenterEntry';
import { FLAVOR } from '@/common/config/flavor';
export const SiderTaskCenterEntry: typeof RealSiderTaskCenterEntry | null =
  FLAVOR === 'public' ? null : RealSiderTaskCenterEntry;
