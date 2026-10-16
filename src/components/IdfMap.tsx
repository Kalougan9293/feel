import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { colorOf, type CategoryLabel } from '../data/categories'
import { SPOTS } from '../data/spots'
import { useMediaQuery } from '../hooks/useMediaQuery'
import './IdfMap.css'

const CYCLE_MS = 3800
const DEFAULT_PIN = '#e11d2e'
const MIN_OUT_PX = 16
const MAX_OUT_PX = 140
const OUT_SHORTEN_PX = 14

function sideOf(x: number): 'left' | 'right' {
  return x < 50 ? 'left' : 'right'
}

type Props = {
  selectedCategory: CategoryLabel | null
}

export function IdfMap({ selectedCategory }: Props) {
  const isMobile = useMediaQuery('(max-width: 720px)')
  const stageRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState(SPOTS[0].id)
  const [paused, setPaused] = useState(false)
  const [outPx, setOutPx] = useState(MIN_OUT_PX)
  const [outPct, setOutPct] = useState(24)

  const visibleSpots = useMemo(() => {
    if (!selectedCategory) return SPOTS
    return SPOTS.filter((s) => s.specialties.includes(selectedCategory))
  }, [selectedCategory])

  const pinColor = selectedCategory ? colorOf(selectedCategory) : DEFAULT_PIN

  const active =
    visibleSpots.find((s) => s.id === activeId) ?? visibleSpots[0] ?? SPOTS[0]

  const side = useMemo(() => sideOf(active.x), [active.x])
  const lineX2 = side === 'left' ? -outPct : 100 + outPct

  useEffect(() => {
    if (!visibleSpots.some((s) => s.id === activeId)) {
      setActiveId(visibleSpots[0]?.id ?? SPOTS[0].id)
    }
  }, [visibleSpots, activeId])

  useEffect(() => {
    if (paused || visibleSpots.length === 0) return
    const id = window.setInterval(() => {
      setActiveId((current) => {
        const idx = visibleSpots.findIndex((s) => s.id === current)
        const next = visibleSpots[(idx + 1) % visibleSpots.length]
        return next.id
      })
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [paused, visibleSpots])

  useEffect(() => {
    if (isMobile) return
    const stage = stageRef.current
    if (!stage) return

    const measure = () => {
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0) return

      const edgePad = 20
      const cardW = Math.min(210, window.innerWidth * 0.38)
      const free =
        side === 'left'
          ? rect.left - edgePad
          : window.innerWidth - rect.right - edgePad

      // Place the card further out when room allows; line stops slightly before
      const usable = Math.max(0, free - cardW)
      const cardOut = Math.min(MAX_OUT_PX, Math.max(MIN_OUT_PX, usable))
      const lineOut = Math.max(MIN_OUT_PX, cardOut - OUT_SHORTEN_PX)

      setOutPx(cardOut)
      setOutPct((lineOut / rect.width) * 100)
      stage.style.setProperty('--leader-out', `${cardOut}px`)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isMobile, side])

  const select = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const cardMotion = isMobile
    ? {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 10 },
      }
    : {
        initial: {
          opacity: 0,
          x: side === 'left' ? -12 : 12,
          y: '-50%',
        },
        animate: { opacity: 1, x: 0, y: '-50%' },
        exit: {
          opacity: 0,
          x: side === 'left' ? -8 : 8,
          y: '-50%',
        },
      }

  return (
    <div
      className={`idf-map${isMobile ? ' is-mobile' : ''}`}
      style={{ ['--pin-color' as string]: pinColor }}
      onMouseEnter={() => !isMobile && setPaused(true)}
      onMouseLeave={() => !isMobile && setPaused(false)}
    >
      <div
        className="idf-map__stage"
        ref={stageRef}
        style={{ ['--leader-out' as string]: `${outPx}px` }}
      >
        <div className="idf-map__frame">
          <img
            className="idf-map__image"
            src="/map-idf.jpg"
            alt="Carte de l’Île-de-France"
            draggable={false}
          />

          <div className="idf-map__layer">
            {(selectedCategory ? visibleSpots : SPOTS).map((spot) => {
              const isActive = spot.id === active.id
              return (
                <button
                  key={spot.id}
                  type="button"
                  className={`idf-map__ping${isActive ? ' is-active' : ''}`}
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  onClick={() => select(spot.id)}
                  onMouseEnter={() => {
                    if (isMobile) return
                    setPaused(true)
                    select(spot.id)
                  }}
                  aria-label={`${spot.name}, ${spot.specialties.join(', ')}, ${spot.area}`}
                  aria-pressed={isActive}
                >
                  <span className="idf-map__ping-halo" />
                  <span className="idf-map__pin" aria-hidden="true">
                    <span className="idf-map__pin-head" />
                    <span className="idf-map__pin-needle" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {!isMobile && (
          <svg
            className="idf-map__svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <AnimatePresence mode="wait">
              <motion.path
                key={`line-${active.id}-${Math.round(outPct)}`}
                d={`M ${active.x} ${active.y} L ${lineX2} ${active.y}`}
                className="idf-map__leader"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          </svg>
        )}

        {!isMobile && (
          <AnimatePresence mode="wait">
            <motion.aside
              key={active.id}
              className={`idf-map__card idf-map__card--${side}`}
              style={{ top: `${active.y}%` }}
              initial={cardMotion.initial}
              animate={cardMotion.animate}
              exit={cardMotion.exit}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
              <div
                className="idf-map__card-media"
                style={{ backgroundImage: `url(${active.image})` }}
              />
              <div className="idf-map__card-body">
                <p className="idf-map__card-type">
                  {active.specialties.join(' · ')}
                </p>
                <h3 className="idf-map__card-title">{active.name}</h3>
                <p className="idf-map__card-area">{active.area}</p>
                <p className="idf-map__card-status">{active.availability}</p>
              </div>
            </motion.aside>
          </AnimatePresence>
        )}
      </div>

      {isMobile && (
        <AnimatePresence mode="wait">
          <motion.aside
            key={active.id}
            className="idf-map__card idf-map__card--sheet"
            initial={cardMotion.initial}
            animate={cardMotion.animate}
            exit={cardMotion.exit}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="idf-map__card-media"
              style={{ backgroundImage: `url(${active.image})` }}
            />
            <div className="idf-map__card-body">
              <p className="idf-map__card-type">
                {active.specialties.join(' · ')}
              </p>
              <h3 className="idf-map__card-title">{active.name}</h3>
              <p className="idf-map__card-area">{active.area}</p>
              <p className="idf-map__card-status">{active.availability}</p>
            </div>
          </motion.aside>
        </AnimatePresence>
      )}
    </div>
  )
}
