import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Modal from '../components/Modal'

const STATS = [
  { value: '93%',  label: 'Model Accuracy',   icon: '◎' },
  { value: '13',   label: 'Disease Classes',   icon: '⬡' },
  { value: '4',    label: 'Crop Types',        icon: '◈' },
  { value: 'Live', label: 'Real-time Analysis',icon: '◉' },
]

const STEPS = [
  { step: '01', title: 'Upload Image',     desc: 'Drag & drop a drone or field photo of your crop. We accept JPEG and PNG.' },
  { step: '02', title: 'AI Analyzes',      desc: 'Our Vision Transformer model extracts features and classifies disease patterns.' },
  { step: '03', title: 'Get Results',      desc: 'Receive a diagnosis with confidence score, severity level, and treatment advice.' },
]

function fadeUp(delay = 0) {
  return {
    initial:  { opacity: 0, y: 24 },
    animate:  { opacity: 1, y: 0  },
    transition: { duration: 0.5, delay, ease: 'easeOut' },
  }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="font-bold text-slate-900 text-lg">AgriSense</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDisclaimer(true)}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Disclaimer
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-4 py-2 rounded-lg transition-colors"
          >
            Dashboard
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div {...fadeUp(0)}>
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI-Powered Precision Agriculture
            </span>
          </motion.div>

          <motion.h1 {...fadeUp(0.08)} className="text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Detect Crop Disease<br />
            <span className="text-emerald-600">Before It Spreads</span>
          </motion.h1>

          <motion.p {...fadeUp(0.14)} className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
            Upload a photo of your crop and get an instant AI-powered diagnosis.
            Our multimodal Vision Transformer identifies 13 diseases across corn, potato, rice, and wheat with 93% accuracy.
          </motion.p>

          <motion.div {...fadeUp(0.2)} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/analyze')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-sm shadow-emerald-200 text-base"
            >
              Start Analysis
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-8 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-base"
            >
              View Dashboard
            </button>
          </motion.div>
        </section>

        {/* Stats */}
        <section className="border-t border-b border-slate-100 bg-slate-50/60">
          <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div key={s.label} {...fadeUp(0.1 + i * 0.06)} className="text-center">
                <div className="text-3xl font-extrabold text-slate-900">{s.value}</div>
                <div className="text-sm text-slate-500 mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-6 py-20">
          <motion.div {...fadeUp(0.05)} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How It Works</h2>
            <p className="text-slate-500">Three steps from photo to diagnosis</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div key={s.step} {...fadeUp(0.1 + i * 0.08)}
                className="relative bg-white border border-slate-100 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl font-extrabold text-slate-100 mb-4 select-none">{s.step}</div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section className="bg-emerald-600 py-14">
          <motion.div {...fadeUp(0.05)} className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to protect your crops?</h2>
            <p className="text-emerald-100 mb-8 text-base">Upload your first image — free and instant.</p>
            <button
              onClick={() => navigate('/analyze')}
              className="inline-flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-700 font-bold px-8 py-3.5 rounded-xl transition-colors text-base shadow"
            >
              Analyze Now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        AgriSense · Crop Disease Detection ·{' '}
        <button onClick={() => setShowDisclaimer(true)} className="underline hover:text-slate-600">
          Disclaimer
        </button>
      </footer>

      {/* Disclaimer Modal */}
      <Modal open={showDisclaimer} onClose={() => setShowDisclaimer(false)} title="Important Disclaimer">
        <p className="mb-3">
          AgriSense is an <strong>experimental research tool</strong> designed to assist in crop disease identification.
          It is not a substitute for professional agronomic advice.
        </p>
        <p className="mb-3">
          Model predictions carry a margin of error. Always validate results with a qualified agricultural expert
          before taking action on your crops.
        </p>
        <p>
          The accuracy of results depends on image quality, lighting conditions, and crop stage.
          Use this tool as a guide, not a definitive diagnosis.
        </p>
      </Modal>
    </div>
  )
}
