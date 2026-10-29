/**
 * The screens' view of live data: each hook returns the server's answer when connected and the built-in
 * sample data otherwise (see resource.ts). Writes elsewhere call invalidate('<key>') so every open screen refreshes.
 */
import { APPLICATIONS } from '../data/applications';
import { GLOSSARY } from '../data/glossary';
import { CALENDAR, MINING, NOTICES, OBLIGATIONS } from '../data/misc';
import { APPLICATION_TYPES } from '../data/rules';
import {
  getAlertSettings,
  getApplications,
  getCalendarEvents,
  getDocuments,
  getDuplicates,
  getForecast,
  getGlossary,
  getInspectionWeights,
  getIntegrations,
  getNoticeList,
  getNotifications,
  getObligations,
  getPerformance,
  getProcessMap,
  getRuleVersions,
  getSavedViews,
  getStatus,
  getTypes,
  localPerformance,
  type ProcessMap,
} from '../services/api';
import { useResource } from './resource';

const LOCAL_PERFORMANCE = localPerformance();

export const useCalendar = () => useResource('calendar', getCalendarEvents, CALENDAR).data;
export const useNotices = () => useResource('notices', getNoticeList, NOTICES).data;
export const useGlossary = () => useResource('glossary', getGlossary, GLOSSARY, 300_000).data;
export const useApplicationTypes = () => useResource('rules:types', getTypes, APPLICATION_TYPES, 120_000).data;
export const usePerformance = () => useResource('performance', getPerformance, LOCAL_PERFORMANCE, 60_000);
export const useStatus = () => useResource('status', getStatus, null, 15_000);
export const useForecast = () => useResource('status:forecast', getForecast, null, 300_000);

/** Officer-scoped (the server applies region locks); built-in data shows every file. */
export const useApplicationsLive = () => useResource('applications', getApplications, APPLICATIONS);
export const useObligationsLive = () => useResource('obligations:all', () => getObligations(), OBLIGATIONS);
export const useProcessMap = () => useResource<ProcessMap>('process-map', getProcessMap, MINING, 60_000);
export const useDuplicates = () => useResource('integrity', getDuplicates, null);
export const useInspectionWeights = () => useResource('inspections:weights', getInspectionWeights, null);
export const useRuleVersions = () => useResource('rules:versions', getRuleVersions, null);
export const useIntegrations = () => useResource('settings:integrations', getIntegrations, null);
export const useAlertSettings = () => useResource('settings:alerts', getAlertSettings, null);
export const useSavedViews = () => useResource('views', getSavedViews, null);
export const useDocuments = () => useResource('documents', getDocuments, null, 10_000);
export const useNotifications = () => useResource('notifications', getNotifications, null, 15_000);
