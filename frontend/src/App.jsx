import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from './api/client'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import CalibrationPage from './pages/CalibrationPage'
import CropAnalysisPage from './pages/CropAnalysisPage'
import DiseaseAnalysisPage from './pages/DiseaseAnalysisPage'
import DroneManagementPage from './pages/DroneManagementPage'

function App() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = async () => {
    try {
      const res = await api.get('/config/active')
      setConfig(res.data)
    } catch {
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-lg">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={config ? <DashboardPage config={config} /> : <Navigate to="/calibration" />} />
          <Route path="/calibration" element={<CalibrationPage onConfigured={fetchConfig} />} />
          <Route path="/crop-analysis" element={config ? <CropAnalysisPage config={config} /> : <Navigate to="/calibration" />} />
          <Route path="/disease-analysis" element={config ? <DiseaseAnalysisPage /> : <Navigate to="/calibration" />} />
          <Route path="/drone" element={config ? <DroneManagementPage /> : <Navigate to="/calibration" />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
