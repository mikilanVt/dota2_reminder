import {useState} from 'react';

type SectionId = 'home' | 'map' | 'heroes' | 'items' | 'knowledge' | 'updates';
type ModeId = 'tests' | 'quiz' | 'fill' | 'guess' | 'mixed';
type TopicId = 'items' | 'heroes' | 'map';

const sections: Array<{id: SectionId; label: string; topbar: string}> = [
  {id: 'map', label: 'КАРТА', topbar: '/assets/topbar_map.webp'},
  {id: 'heroes', label: 'ГЕРОИ', topbar: '/assets/topbar_heroes.webp'},
  {id: 'items', label: 'ПРЕДМЕТЫ', topbar: '/assets/topbar_items.webp'},
  {id: 'knowledge', label: 'БАЗА ЗНАНИЙ', topbar: '/assets/topbar_bazaznaniy.webp'},
  {id: 'updates', label: 'ОБНОВЛЕНИЯ', topbar: '/assets/topbar_updates.webp'}
];

const modes: Array<{id: ModeId; label: string}> = [
  {id: 'tests', label: 'ТЕСТЫ'},
  {id: 'quiz', label: 'ВИКТОРИНА'},
  {id: 'fill', label: 'ВСТАВЬ СЛОВО/ЧИСЛО'},
  {id: 'guess', label: 'УГАДАЙ ГЕРОЯ'},
  {id: 'mixed', label: 'СМЕШАННЫЙ'}
];

const topics: Array<{id: TopicId; label: string; image: string}> = [
  {id: 'items', label: 'ПРЕДМЕТЫ', image: '/assets/game_mode_items.webp'},
  {id: 'heroes', label: 'ГЕРОИ', image: '/assets/game_mode_heroes.webp'},
  {id: 'map', label: 'КАРТА', image: '/assets/game_mode_map.webp'}
];

const topbarBySection: Record<SectionId, string> = {
  home: '/assets/topbar_home.webp',
  map: '/assets/topbar_map.webp',
  heroes: '/assets/topbar_heroes.webp',
  items: '/assets/topbar_items.webp',
  knowledge: '/assets/topbar_bazaznaniy.webp',
  updates: '/assets/topbar_updates.webp'
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
    <div className="app-shell">
      <header
        className="topbar"
        style={{backgroundImage: `url(${topbarBySection[activeSection]})`}}
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
              <img src="/assets/main_home_picture.webp" alt="" />
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
                            style={{backgroundImage: `url(${topic.image})`}}
                            onClick={() => toggleTopic(topic.id)}
                          >
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

            <button className="find-game-button" type="button">
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
