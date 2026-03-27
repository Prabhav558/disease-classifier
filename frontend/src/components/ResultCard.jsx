import { motion } from 'framer-motion'
import ConfidenceBar, { ConfidenceBadge } from './ConfidenceBar'

const DISEASE_INFO = {
  'Corn___Common_Rust':       { name: 'Corn Common Rust',          severity: 'medium',   description: 'Fungal disease caused by Puccinia sorghi. Small, oval brick-red pustules appear on leaves.',                                                  treatment: 'Apply triazole fungicides. Remove infected debris. Use resistant varieties.' },
  'Corn___Gray_Leaf_Spot':    { name: 'Corn Gray Leaf Spot',       severity: 'high',     description: 'Caused by Cercospora zeae-maydis. Rectangular gray-to-tan lesions running parallel to leaf veins.',                                             treatment: 'Apply fungicides at early silk stage. Practice crop rotation. Improve air circulation.' },
  'Corn___Northern_Leaf_Blight':{ name: 'Northern Leaf Blight',    severity: 'medium',   description: 'Caused by Exserohilum turcicum. Cigar-shaped tan lesions 2.5–15 cm long on corn leaves.',                                                       treatment: 'Apply foliar fungicides when lesions first appear. Rotate crops. Use resistant hybrids.' },
  'Corn___healthy':           { name: 'Healthy Corn',              severity: 'none',     description: 'No disease detected. The plant appears healthy with normal leaf structure and coloration.',                                                       treatment: 'Continue regular monitoring and maintain optimal nutrition.' },
  'Potato___Early_Blight':    { name: 'Potato Early Blight',       severity: 'medium',   description: 'Caused by Alternaria solani. Dark-brown spots with concentric rings resembling a target on older leaves.',                                       treatment: 'Apply chlorothalonil or mancozeb. Remove infected foliage. Maintain adequate nutrition.' },
  'Potato___Late_Blight':     { name: 'Potato Late Blight',        severity: 'critical', description: 'Caused by Phytophthora infestans — the pathogen behind the Irish Potato Famine. Water-soaked lesions turning dark brown rapidly.',               treatment: 'Apply fungicides preventively. Destroy infected plants immediately. Avoid overhead irrigation.' },
  'Potato___healthy':         { name: 'Healthy Potato',            severity: 'none',     description: 'No disease detected. The plant appears healthy.',                                                                                                 treatment: 'Continue regular monitoring and maintenance.' },
  'Rice___Brown_Spot':        { name: 'Rice Brown Spot',           severity: 'medium',   description: 'Caused by Helminthosporium oryzae. Oval to circular brown spots on leaves, often with yellow halo.',                                             treatment: 'Apply carbendazim or propiconazole. Ensure balanced potassium nutrition. Use certified seeds.' },
  'Rice___Leaf_Blast':        { name: 'Rice Leaf Blast',           severity: 'high',     description: 'Caused by Magnaporthe oryzae. Diamond or spindle-shaped lesions that expand rapidly under humid conditions.',                                    treatment: 'Apply tricyclazole or isoprothiolane fungicides. Avoid excess nitrogen. Use blast-resistant varieties.' },
  'Rice___Neck_Blast':        { name: 'Rice Neck Blast',           severity: 'critical', description: 'Magnaporthe oryzae infecting the neck node, causing panicle lodging. Can cause severe yield loss.',                                              treatment: 'Spray fungicides at heading stage. Ensure adequate silicon and potassium. Avoid planting during high-risk periods.' },
  'Wheat___Brown_Rust':       { name: 'Wheat Brown Rust',          severity: 'medium',   description: 'Caused by Puccinia triticina. Orange-brown pustules scattered on upper leaf surfaces.',                                                          treatment: 'Apply propiconazole or tebuconazole. Use resistant wheat varieties. Monitor and spray early.' },
  'Wheat___Septoria':         { name: 'Wheat Septoria Leaf Blotch',severity: 'high',     description: 'Caused by Zymoseptoria tritici. Tan-brown lesions with black fruiting bodies progressing from lower to upper leaves.',                           treatment: 'Apply azole or strobilurin fungicides. Rotate crops. Use resistant varieties.' },
  'Wheat___Yellow_Rust':      { name: 'Wheat Yellow Rust',         severity: 'high',     description: 'Caused by Puccinia striiformis. Distinct yellow-orange stripes along leaf veins. Highly destructive in cool, moist conditions.',                 treatment: 'Apply triazole fungicides at first sign. Monitor fields closely. Use stripe rust-resistant varieties.' },
}

const SEVERITY_STYLES = {
  none:     { card: 'border-emerald-200 bg-emerald-50/30', icon: '✓', iconBg: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  medium:   { card: 'border-amber-200 bg-amber-50/30',    icon: '⚠', iconBg: 'bg-amber-100 text-amber-600',    badge: 'bg-amber-100 text-amber-700'   },
  high:     { card: 'border-orange-200 bg-orange-50/30',  icon: '!', iconBg: 'bg-orange-100 text-orange-600',  badge: 'bg-orange-100 text-orange-700' },
  critical: { card: 'border-red-200 bg-red-50/30',        icon: '✕', iconBg: 'bg-red-100 text-red-600',        badge: 'bg-red-100 text-red-700'       },
}

function clean(key) {
  return key.replace(/___/g, ' › ').replace(/_/g, ' ')
}

export default function ResultCard({ prediction, confidence, allProbs }) {
  const info = DISEASE_INFO[prediction] || {
    name: clean(prediction),
    severity: 'medium',
    description: 'Analysis complete.',
    treatment: 'Consult an agricultural expert for specific guidance.',
  }
  const style = SEVERITY_STYLES[info.severity]

  // Top 3 alternatives (excluding the top prediction)
  const alternatives = allProbs
    ? Object.entries(allProbs)
        .sort(([, a], [, b]) => b - a)
        .filter(([k]) => k !== prediction)
        .slice(0, 3)
    : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`rounded-2xl border-2 ${style.card} overflow-hidden`}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${style.iconBg}`}>
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold text-slate-900">{info.name}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${style.badge}`}>
                {info.severity === 'none' ? 'Healthy' : `${info.severity} severity`}
              </span>
            </div>
            <p className="text-sm text-slate-500">{clean(prediction)}</p>
          </div>
        </div>

        {/* Confidence */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Prediction Confidence</span>
            <ConfidenceBadge value={confidence} />
          </div>
          <ConfidenceBar value={confidence} showLabel={false} height="h-3" />
          <p className="text-right text-lg font-bold text-slate-800 mt-1">{confidence.toFixed(1)}%</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200 mx-6" />

      {/* Description */}
      <div className="px-6 py-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">What this means</h3>
        <p className="text-sm text-slate-700 leading-relaxed">{info.description}</p>
      </div>

      {/* Treatment */}
      {info.severity !== 'none' && (
        <>
          <div className="h-px bg-slate-200 mx-6" />
          <div className="px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recommended action</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{info.treatment}</p>
          </div>
        </>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <>
          <div className="h-px bg-slate-200 mx-6" />
          <div className="px-6 py-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Alternative predictions</h3>
            <div className="space-y-2.5">
              {alternatives.map(([key, prob]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-40 truncate">{clean(key)}</span>
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-slate-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${prob}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-10 text-right">{prob.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
