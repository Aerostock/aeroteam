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

function AppContent() {
  const { activeProfile } = useApp()
  if (!activeProfile) return <ProfileSelector />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<ImportExcel />} />
        <Route path="/taches" element={<Taches />} />
        <Route path="/equipes" element={<Equipes />} />
        <Route path="/affectation" element={<Affectation />} />
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
