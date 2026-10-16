import { Link } from 'react-router-dom'
import './HowItWorks.css'

const STEPS = [
  {
    n: '01',
    label: 'Trouvez',
    title: 'Trouvez votre espace',
    text: 'Découvrez des espaces adaptés à votre métier.',
    image: '/hero-salon.jpg',
    alt: 'Salon professionnel moderne',
  },
  {
    n: '02',
    label: 'Réservez',
    title: 'Réservez sans contrainte',
    text: 'À l’heure, à la journée, au mois ou à l’année — vous choisissez la durée qui vous arrange, sans engagement forcé.',
    image: '/inspiration-cabine.jpg',
    alt: 'Cabine de soins prête à l’emploi',
  },
  {
    n: '03',
    label: 'Exercez',
    title: 'Accueillez vos clients',
    text: 'Accueillez vos clients dans un espace adapté à votre activité.',
    image:
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=80',
    alt: 'Professionnelle accueillant un client',
  },
] as const

export function HowItWorks() {
  return (
    <section className="how" id="comment-ca-marche">
      <div className="how__inner">
        <header className="how__header">
          <h2 className="how__title">Comment ça marche ?</h2>
          <p className="how__lead">
            Un espace, quelques clics, et vous êtes prêt à exercer.
          </p>
        </header>

        <ol className="how__steps">
          {STEPS.map((step) => (
            <li key={step.n} className="how__step">
              <div className="how__media" tabIndex={0}>
                <img src={step.image} alt={step.alt} loading="lazy" />
                <span className="how__badge">
                  {step.n} — {step.label}
                </span>
              </div>
              <h3 className="how__step-title">{step.title}</h3>
              <p className="how__step-text">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="how__owners">
          <p className="how__owners-line">
            <span>Vous avez un espace à proposer ?</span>
            <Link className="how__owners-cta" to="/proprietaire">
              Ouvrir le cockpit
              <span aria-hidden="true">↗</span>
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
