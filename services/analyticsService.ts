import { isOnline } from './networkService';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = 'G-Y5C9J5SQ1T';
const GA_SCRIPT_ID = 'cozy-pocket-ga';

let analyticsInitialized = false;

export const initAnalytics = () => {
  if (!import.meta.env.PROD) return;
  if (!isOnline()) return;
  if (analyticsInitialized) return;
  if (document.getElementById(GA_SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);

  const script = document.createElement('script');
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.onerror = () => {
    analyticsInitialized = false;
  };
  document.head.appendChild(script);

  analyticsInitialized = true;
};
