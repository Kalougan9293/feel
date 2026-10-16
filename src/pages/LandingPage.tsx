import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HowItWorks } from '../components/HowItWorks'
import { IdfMap } from '../components/IdfMap'
import { RoleModal, type UserRole } from '../components/RoleModal'
import { CATEGORIES, type CategoryLabel } from '../data/categories'
import '../App.css'

export function LandingPage() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryLabel | null>(null)
  const [roleOpen, setRoleOpen] = useState(false)

  const toggleCategory = (label: CategoryLabel) => {
    setSelectedCategory((prev) => (prev === label ? null : label))
  }

  const openRoleModal = () => setRoleOpen(true)

  const handleRoleSelect = (role: UserRole) => {
    if (role === 'professionnel') {
      navigate('/professionnel')
      return
    }
    navigate('/proprietaire')
  }

  return (
    <div className="page">
      <header className="nav">
        <Link className="nav__brand" to="/">
          STUDIØ
        </Link>
        <button type="button" className="nav__login" onClick={openRoleModal}>
          Se connecter
        </button>
      </header>

      <main className="hero">
        <div className="hero__copy">
          <motion.h1
            className="hero__title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            Exercez où vous voulez, quand vous voulez.
          </motion.h1>

          <motion.p
            className="hero__subtitle"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            Choisissez votre salon, bloquez votre créneau, et concentrez-vous sur
            ce que vous faites de mieux.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <button type="button" className="hero__cta" onClick={openRoleModal}>
              Réserver un espace
            </button>
          </motion.div>

          <motion.ul
            className="hero__tags"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.label
              return (
                <li key={cat.label}>
                  <button
                    type="button"
                    className={`hero__tag${isActive ? ' is-active' : ''}`}
                    style={{ ['--tag-color' as string]: cat.color }}
                    onClick={() => toggleCategory(cat.label)}
                    aria-pressed={isActive}
                  >
                    <span className="hero__tag-fill" />
                    <span className="hero__tag-label">{cat.label}</span>
                  </button>
                </li>
              )
            })}
          </motion.ul>
        </div>

        <section className="hero__map" aria-label="Espaces en Île-de-France">
          <IdfMap selectedCategory={selectedCategory} />
        </section>
      </main>

      <HowItWorks />

      <RoleModal
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        onSelect={handleRoleSelect}
      />
    </div>
  )
}
