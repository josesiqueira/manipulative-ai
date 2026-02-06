import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n/request';

export default createMiddleware({
  locales,
  defaultLocale: 'en',
  localeDetection: true,
});

export const config = {
  matcher: ['/', '/(en|fi)/:path*'],
};
