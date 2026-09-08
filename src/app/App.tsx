import {useState, type CSSProperties} from 'react';

type SectionId = 'home' | 'map' | 'heroes' | 'items' | 'knowledge' | 'updates';
type ModeId = 'tests' | 'quiz' | 'fill' | 'guess' | 'mixed';
type TopicId = 'items' | 'heroes' | 'map';

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

const sections: Array<{id: SectionId; label: string}> = [
  {id: 'map', label: 'КАРТА'},
  {id: 'heroes', label: 'ГЕРОИ'},
  {id: 'items', label: 'ПРЕДМЕТЫ'},
  {id: 'knowledge', label: 'БАЗА ЗНАНИЙ'},
  {id: 'updates', label: 'ОБНОВЛЕНИЯ'}
];

const modes: Array<{id: ModeId; label: string}> = [
  {id: 'tests', label: 'ТЕСТЫ'},
  {id: 'quiz', label: 'ВИКТОРИНА'},
  {id: 'fill', label: 'ВСТАВЬ СЛОВО/ЧИСЛО'},
  {id: 'guess', label: 'УГАДАЙ ГЕРОЯ'},
  {id: 'mixed', label: 'СМЕШАННЫЙ'}
];

const topics: Array<{id: TopicId; label: string; image: string}> = [
  {id: 'items', label: 'ПРЕДМЕТЫ', image: asset('game_mode_items.webp')},
  {id: 'heroes', label: 'ГЕРОИ', image: asset('game_mode_heroes.webp')},
  {id: 'map', label: 'КАРТА', image: asset('game_mode_map.webp')}
];

const topbarBySection: Record<SectionId, string> = {
  home: asset('topbar_home.png'),
  map: asset('topbar_map.png'),
  heroes: asset('topbar_heroes.png'),
  items: asset('topbar_items.png'),
  knowledge: asset('topbar_bazaznaniy.png'),
  updates: asset('topbar_updates.png')
};

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('home');
  const [selectedMode, setSelectedMode] = useState<ModeId | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<TopicId[]>([]);

  function selectMode(modeId: ModeId) {
    if (selectedMode === modeId) {
      setSelectedMode(null);
      setSelectedTopics([]);
      return;
    }

    setSelectedMode(modeId);
    setSelectedTopics([]);
  }

  function toggleTopic(topicId: TopicId) {
    setSelectedTopics((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId]
    );
  }

  return (
    <div
      className="app-shell"
      style={{
        backgroundImage: `linear-gradient(rgba(3, 8, 14, 0.06), rgba(3, 8, 14, 0.2)), url(${asset('background.webp')})`
      }}
    >
      <header
        className="topbar"
        style={{'--topbar-image': `url(${topbarBySection[activeSection]})`} as CSSProperties}
      >
        <button
          className="home-button"
          type="button"
          aria-label="ГЛАВНАЯ"
          title="ГЛАВНАЯ"
          onClick={() => setActiveSection('home')}
        />
        <nav className="nav" aria-label="Основная навигация">
          {sections.map((section) => (
            <button
              className={`nav-link${activeSection === section.id ? ' is-active' : ''}`}
              type="button"
              key={section.id}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </header>

      {activeSection === 'home' ? (
        <main className="home-screen">
          <section className="mode-picker" aria-label="Выбор режима тренировки">
            <div className="mode-preview" aria-hidden="true">
              <img src={asset('main_home_picture.webp')} alt="" />
            </div>

            <div className="mode-list">
              {modes.map((mode) => (
                <div className="mode-block" key={mode.id}>
                  <button
                    className={`mode-button${selectedMode === mode.id ? ' is-selected' : ''}`}
                    type="button"
                    aria-pressed={selectedMode === mode.id}
                    onClick={() => selectMode(mode.id)}
                  >
                    {mode.label}
                  </button>

                  {selectedMode === mode.id && (
                    <div className="topic-panel">
                      {topics.map((topic) => {
                        const checked = selectedTopics.includes(topic.id);
                        return (
                          <button
                            className={`topic-option${checked ? ' is-checked' : ''}`}
                            type="button"
                            aria-pressed={checked}
                            key={topic.id}
                            onClick={() => toggleTopic(topic.id)}
                          >
                            <img className="topic-art" src={topic.image} alt="" decoding="async" />
                            <span className="topic-check" aria-hidden="true" />
                            <span className="topic-label">{topic.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              className="find-game-button"
              type="button"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08)), url(${asset('background_play_button.webp')})`
              }}
            >
              НАЙТИ ИГРУ
            </button>
          </section>
        </main>
      ) : (
        <main className="section-placeholder">
          <span>{sections.find((section) => section.id === activeSection)?.label}</span>
        </main>
      )}
    </div>
  );
}
