import { motion } from 'framer-motion'

const variants = {
  initial:  { opacity: 0, y: 16 },
  animate:  { opacity: 1, y: 0  },
  exit:     { opacity: 0, y: -8 },
}

export default function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
