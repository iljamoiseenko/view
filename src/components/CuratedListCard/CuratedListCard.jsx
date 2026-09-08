import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import './CuratedListCard.css'

export default function CuratedListCard({ list }) {
  const { t } = useLanguage()

  return (
    <Link to={`/curated/${list.id}`} className="clcard">
      <div className="clcard__img-wrap">
        {list.coverImage
          ? <img className="clcard__img" src={list.coverImage} alt={list.title} loading="lazy" />
          : <div className="clcard__img clcard__img--empty" />
        }
        <div className="clcard__overlay" />

        <div className="clcard__top">
          <span className="clcard__count">{t('curated.placesCount', list.placeIds.length)}</span>
          {list.icon && <span className="clcard__icon">{list.icon}</span>}
        </div>

        <div className="clcard__body">
          <h3 className="clcard__title">{list.title}</h3>
          <div className="clcard__author">
            {list.authorAvatar
              ? <img className="clcard__avatar" src={list.authorAvatar} alt={list.authorName} />
              : <div className="clcard__avatar clcard__avatar--empty">{list.authorName?.[0]}</div>
            }
            <div className="clcard__author-info">
              <span className="clcard__author-name">{list.authorName}</span>
              {list.authorRole && <span className="clcard__author-role">{list.authorRole}</span>}
            </div>
          </div>
        </div>

        <span className="clcard__arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </span>
      </div>
    </Link>
  )
}
