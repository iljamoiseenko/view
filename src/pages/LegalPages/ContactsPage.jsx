import { useLanguage } from '../../context/LanguageContext'
import './LegalPages.css'

export default function ContactsPage() {
  const { t } = useLanguage()
  const fields = t('contacts.fields')
  return (
    <div className="legal">
      <div className="legal__hero">
        <div className="container">
          <p className="legal__eyebrow">{t('contacts.eyebrow')}</p>
          <h1 className="legal__title">{t('contacts.title')}</h1>
        </div>
      </div>

      <div className="container">
        <div className="legal__body">
          <div className="legal__section">
            <h2>{t('contacts.orgTitle')}</h2>
            <ul className="legal__contact-list">
              {fields.map((f, i) => (
                <li key={i}>
                  <span className="legal__contact-label">{f.label}</span>
                  <span dangerouslySetInnerHTML={{ __html: f.value }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
