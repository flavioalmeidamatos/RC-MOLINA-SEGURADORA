import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './app.tsx';
import './index.css';

// Intercept fetch to append master admin context
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
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
