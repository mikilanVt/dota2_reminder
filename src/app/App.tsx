const sections = ['Карта', 'Герои', 'Предметы', 'База знаний', 'Обновления'];

export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" aria-label="На главную">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DotaReminder</span>
        </button>
        <nav className="nav" aria-label="Основная навигация">
          {sections.map((section) => (
            <button className="nav-link" type="button" key={section}>{section}</button>
          ))}
        </nav>
      </header>
      <main className="foundation-screen">
        <p className="eyebrow">PROJECT FOUNDATION</p>
        <h1>Основа DotaReminder готова к следующему этапу.</h1>
        <p>
          Это технический экран-заглушка. Полноценный интерфейс в стилистике клиента Dota 2
          будет собран и согласован отдельно на этапе дизайна.
        </p>
      </main>
    </div>
  );
}
