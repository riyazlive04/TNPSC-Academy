// TEMPORARY dev-only harness: renders WelcomeIntroPage outside the auth guard
// so the slides can be screenshotted. Deleted after the check.
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import './index.css'
import WelcomeIntroPage from './pages/WelcomeIntroPage'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <WelcomeIntroPage />
  </MemoryRouter>
)
