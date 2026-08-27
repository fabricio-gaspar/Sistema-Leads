import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/system/AppErrorBoundary.tsx'
import { SupabaseConfigurationRequired } from './components/system/SupabaseConfigurationRequired.tsx'
import { isSupabaseConfigured } from './lib/supabase.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {isSupabaseConfigured ? <App /> : <SupabaseConfigurationRequired />}
    </AppErrorBoundary>
  </StrictMode>,
)
