import { useLanguage } from '../../context/LanguageContext'
import './LegalPages.css'

export default function TermsPage() {
  const { t } = useLanguage()
  return (
    <div className="legal">
      <div className="legal__hero">
        <div className="container">
          <p className="legal__eyebrow">{t('terms.eyebrow')}</p>
          <h1 className="legal__title">{t('terms.title')}</h1>
          <p className="legal__updated">{t('terms.updated')}</p>
        </div>
      </div>

      <div className="container">
        <div className="legal__body">
          {t('terms.sections').map((s, i) => (
            <div className="legal__section" key={i}>
              <h2>{s.title}</h2>
              <p dangerouslySetInnerHTML={{ __html: s.text }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
