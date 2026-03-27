import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import api from './api/client'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/Toast'

import LandingPage        from './pages/LandingPage'
import AnalyzePage        from './pages/AnalyzePage'
import ProcessingPage     from './pages/ProcessingPage'
import ResultsPage        from './pages/ResultsPage'
import DashboardPage      from './pages/DashboardPage'
import CalibrationPage    from './pages/CalibrationPage'
import CropAnalysisPage   from './pages/CropAnalysisPage'
import DiseaseAnalysisPage from './pages/DiseaseAnalysisPage'
import DroneManagementPage from './pages/DroneManagementPage'
import WaterSupplyPage    from './pages/WaterSupplyPage'
import ChatPage           from './pages/ChatPage'

// Pages that render without the sidebar shell
const STANDALONE = ['/', '/analyze', '/processing', '/results']

function DashboardShell({ children }) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [config,  setConfig]  = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = async () => {
    try   { const res = await api.get('/config/active'); setConfig(res.data) }
    catch { setConfig(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchConfig() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading AgriSense…</p>
        </div>
      </div>
    )
  }

  const isStandalone = STANDALONE.includes(location.pathname)

  return (
    <>
      <ToastContainer />

      {isStandalone ? (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"           element={<LandingPage />} />
            <Route path="/analyze"    element={<AnalyzePage />} />
            <Route path="/processing" element={<ProcessingPage />} />
            <Route path="/results"    element={<ResultsPage />} />
          </Routes>
        </AnimatePresence>
      ) : (
        <DashboardShell>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/dashboard"       element={config ? <DashboardPage config={config} />    : <Navigate to="/calibration" />} />
              <Route path="/calibration"     element={<CalibrationPage onConfigured={fetchConfig} />} />
              <Route path="/crop-analysis"   element={config ? <CropAnalysisPage />                 : <Navigate to="/calibration" />} />
              <Route path="/disease-analysis"element={config ? <DiseaseAnalysisPage />              : <Navigate to="/calibration" />} />
              <Route path="/drone"           element={config ? <DroneManagementPage />              : <Navigate to="/calibration" />} />
              <Route path="/water"           element={config ? <WaterSupplyPage />                  : <Navigate to="/calibration" />} />
              <Route path="/chat"            element={<ChatPage />} />
              {/* Catch-all: send old "/" to landing */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AnimatePresence>
        </DashboardShell>
      )}
    </>
  )
}
