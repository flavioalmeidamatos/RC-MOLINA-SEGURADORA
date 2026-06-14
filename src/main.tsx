import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './app.tsx';
import './index.css';

// Intercept fetch to append master admin context and session headers
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    const initObj = { ...init };
    const headers = new Headers(initObj.headers || {});
    
    // Inject session headers for authentication/identity
    try {
      const rawSession = sessionStorage.getItem('rcmolina_usuario_session');
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session?.user?.id && session?.user?.email) {
          if (!headers.has('x-user-id')) {
            headers.set('x-user-id', session.user.id);
          }
          if (!headers.has('x-user-email')) {
            headers.set('x-user-email', session.user.email);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing session in fetch interceptor:', e);
    }
    
    initObj.headers = headers;
    init = initObj;

    // Inject company/member context query params
    const companyId = sessionStorage.getItem('rc_master_company_id');
    const memberId = sessionStorage.getItem('rc_master_member_id');
    
    if (companyId) {
      const url = new URL(input, window.location.origin);
      url.searchParams.set('company_id', companyId);
      if (memberId) {
        url.searchParams.set('user_id', memberId);
      } else {
        url.searchParams.set('user_id', 'all');
      }
      input = url.toString().replace(window.location.origin, '');
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
