import { motion, useReducedMotion } from 'motion/react'

/**
 * Lightweight scroll-reveal used by the public landing pages: fade + a short
 * rise the first time a block scrolls into view, and nothing at all when the
 * visitor has asked for reduced motion.
 *
 * Lives here rather than in each page because the Group 1 and Group II/IIA
 * landing pages are deliberately the same layout — two private copies drifted
 * apart on timing the moment either one was tuned.
 */
export default function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
