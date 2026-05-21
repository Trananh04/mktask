import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi)
  .use(initReactI18next)
  .init({
    lng: 'vi',
    fallbackLng: 'vi',
    supportedLngs: ['vi'],
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    ns: ['common', 'projects', 'workspaces', 'workspace-home', 'tasks', 'activities', 'settings', 'sprints', 'calendar', 'analytics', 'members', 'project-members', 'project-settings', 'header', 'sidebar', 'organizations', 'admin'],
    defaultNS: 'common',
    load: 'languageOnly',
  });

export default i18n;
