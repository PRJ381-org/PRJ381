/**
 * Microsoft Entra ID (Azure AD) sign-in configuration.
 *
 * Fill in clientId/tenantId once the App Registration is approved (see Chris).
 * Until then, MS_CONFIG.clientId stays empty and login.js disables the
 * "Sign in with Microsoft" button instead of trying to use it.
 */
export const MS_CONFIG = {
  clientId: '', // Entra ID App Registration (Application) ID
  tenantId: '', // Belgium Campus Entra ID tenant ID
  redirectUri: window.location.origin + window.location.pathname,
};
