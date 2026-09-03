import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Layout from './components/Layout'
import ProfileSelector from './pages/ProfileSelector'
import Dashboard from './pages/Dashboard'
import ImportExcel from './pages/ImportExcel'
import Taches from './pages/Taches'
import Equipes from './pages/Equipes'
import Affectation from './pages/Affectation'
import Export from './pages/Export'
import Preparation from './pages/Preparation'

function AppContent() {
  const { activeProfile, loading, error } = useApp()
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-500">Chargement…</p>
        {error && <p className="text-sm text-red-600 max-w-md text-center">{error}</p>}
      </div>
    )
  }
  if (!activeProfile) return <ProfileSelector />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<ImportExcel />} />
        <Route path="/taches" element={<Taches />} />
        <Route path="/equipes" element={<Equipes />} />
        <Route path="/affectation" element={<Affectation />} />
        <Route path="/preparation" element={<Preparation />} />
        <Route path="/export" element={<Export />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  )
}

export default App
