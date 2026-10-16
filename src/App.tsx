import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { ProfessionnelPage } from './pages/ProfessionnelPage'
import { ProprietairePage } from './pages/ProprietairePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/professionnel" element={<ProfessionnelPage />} />
        <Route path="/proprietaire" element={<ProprietairePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
