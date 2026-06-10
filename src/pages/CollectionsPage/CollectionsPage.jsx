import './CollectionsPage.css'

export default function CollectionsPage() {
  return (
    <div className="coll-page">
      <div className="container coll-page__inner">
        <span className="coll-page__badge">Незабаром</span>
        <h1 className="coll-page__title">Підбірки</h1>
        <p className="coll-page__sub">
          Кращі місця для побачення, ділових обідів,<br/>
          вечірок та всього іншого — зібрані в добірки
        </p>
        <div className="coll-page__cards">
          {[
            { icon: '🌙', label: 'Романтичний вечір' },
            { icon: '💼', label: 'Бізнес-ланч' },
            { icon: '🎉', label: 'Корпоратив' },
            { icon: '☕', label: 'Ранкова кава' },
            { icon: '🎸', label: 'Вечір живої музики' },
            { icon: '🌿', label: 'Літня тераса' },
          ].map(item => (
            <div key={item.label} className="coll-page__card">
              <span className="coll-page__card-icon">{item.icon}</span>
              <span className="coll-page__card-label">{item.label}</span>
              <span className="coll-page__card-soon">Скоро</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
