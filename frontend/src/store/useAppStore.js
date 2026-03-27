import { create } from 'zustand'

const useAppStore = create((set) => ({
  uploadedImage: null,      // File object
  imagePreviewUrl: null,    // blob URL for preview
  zoneId: null,
  sensorData: { n: '', p: '', k: '', soil_moisture: '' },
  predictionResult: null,   // { prediction, confidence, all_probs_json, droneAnalysis }
  isLoading: false,
  loadingMessage: '',
  error: null,
  toasts: [],

  setUploadedImage: (file, previewUrl) => set({ uploadedImage: file, imagePreviewUrl: previewUrl }),
  setZoneId: (id) => set({ zoneId: id }),
  setSensorData: (data) => set({ sensorData: data }),
  setPredictionResult: (result) => set({ predictionResult: result }),
  setLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message }),
  setError: (error) => set({ error }),
  reset: () => set({
    uploadedImage: null,
    imagePreviewUrl: null,
    zoneId: null,
    sensorData: { n: '', p: '', k: '', soil_moisture: '' },
    predictionResult: null,
    isLoading: false,
    loadingMessage: '',
    error: null,
  }),

  addToast: (message, type = 'error') => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export default useAppStore
