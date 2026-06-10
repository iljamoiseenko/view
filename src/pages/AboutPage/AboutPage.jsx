import { Link } from 'react-router-dom'
import './AboutPage.css'

export default function AboutPage() {
  return (
    <div className="about">
      <div className="about__hero">
        <div className="container about__hero-inner">
          <p className="about__eyebrow">Про проект</p>
          <h1 className="about__title">VIEW — твій гід<br/>по Харкову</h1>
          <p className="about__sub">Знаходь заклади, події та місця де провести час</p>
        </div>
      </div>

      <div className="container about__body">
        <div className="about__blocks">
          <div className="about__block">
            <span className="about__block-icon">📍</span>
            <h2>Що таке VIEW</h2>
            <p>VIEW — це платформа для відкриття кращих закладів Харкова. Ресторани, бари, кав'ярні, театри та виставки — все в одному місці.</p>
          </div>
          <div className="about__block">
            <span className="about__block-icon">🎭</span>
            <h2>Афіша подій</h2>
            <p>Слідкуй за актуальними подіями: живою музикою, DJ-сетами, майстер-класами та тематичними вечірками.</p>
          </div>
          <div className="about__block">
            <span className="about__block-icon">🏢</span>
            <h2>Для закладів</h2>
            <p>Власник закладу? Додай своє місце на платформу та залучай нових відвідувачів через афішу подій.</p>
          </div>
        </div>

        <div className="about__cta">
          <Link to="/" className="btn btn-dark">Переглянути заклади</Link>
          <Link to="/register" className="btn btn-outline">Додати свій заклад</Link>
        </div>
      </div>
    </div>
  )
}
