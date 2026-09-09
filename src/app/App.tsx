import {useRef, useState, type ComponentType, type CSSProperties} from 'react';
import type {TopicId} from '../data/types';
import type {TrainingHubProps} from '../features/training/TrainingHub';

type SectionId = 'home' | 'map' | 'heroes' | 'items' | 'knowledge' | 'updates';
type ModeId = 'tests' | 'quiz' | 'fill' | 'guess' | 'mixed';

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

// Tab edges in the original 3840px-wide topbar artwork, including its slant.
const sections: Array<{id: SectionId; label: string; start: number}> = [
  {id: 'map', label: 'КАРТА', start: 752},
  {id: 'heroes', label: 'ГЕРОИ', start: 1081},
  {id: 'items', label: 'ПРЕДМЕТЫ', start: 1411},
  {id: 'knowledge', label: 'БАЗА ЗНАНИЙ', start: 1741},
  {id: 'updates', label: 'ОБНОВЛЕНИЯ', start: 2071}
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
  home: asset('topbar_home.webp'),
  map: asset('topbar_map.webp'),
  heroes: asset('topbar_heroes.webp'),
  items: asset('topbar_items.webp'),
  knowledge: asset('topbar_bazaznaniy.webp'),
  updates: asset('topbar_updates.webp')
};

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('home');
  const [selectedMode, setSelectedMode] = useState<ModeId | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<TopicId[]>([]);
  const [TrainingHub, setTrainingHub] = useState<ComponentType<TrainingHubProps> | null>(null);
  const [trainingEntry, setTrainingEntry] = useState<TrainingHubProps['entry']>('play');
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [startNotice, setStartNotice] = useState('');
  const launchVersion = useRef(0);

  function clearLaunch() {
    launchVersion.current++;
    setLoadingTraining(false);
    setStartNotice('');
  }

  function navigate(section: SectionId) {
    clearLaunch();
    setTrainingOpen(false);
    setActiveSection(section);
    window.scrollTo(0, 0);
  }

  async function startTraining() {
    if (!selectedMode) {
      setStartNotice('Сначала выбери режим «Тесты» и тему «Предметы».');
      return;
    }
    if (selectedMode !== 'tests') {
      setStartNotice('Этот режим ещё готовится. Сейчас можно пройти «Тесты» по предметам.');
      return;
    }
    if (selectedTopics.length !== 1 || selectedTopics[0] !== 'items') {
      setStartNotice('В первом наборе готовы предметы. Выбери только «Предметы» — вопросы по героям и карте добавим позже.');
      return;
    }
    await openTraining('play');
  }

  async function openTraining(entry: TrainingHubProps['entry']) {
    setStartNotice('');
    setTrainingEntry(entry);
    if (TrainingHub) {
      setTrainingOpen(true);
      return;
    }
    const version = ++launchVersion.current;
    setLoadingTraining(true);
    try {
      // Load both the game and its question bank only after the player starts.
      const module = await import('../features/training/TrainingHub');
      if (version !== launchVersion.current) return;
      setTrainingHub(() => module.TrainingHub);
      setTrainingOpen(true);
    } catch {
      if (version === launchVersion.current)
        setStartNotice('Не удалось открыть тренировку. Проверь соединение и попробуй ещё раз.');
    } finally {
      if (version === launchVersion.current) setLoadingTraining(false);
    }
  }

  function selectMode(modeId: ModeId) {
    clearLaunch();
    if (selectedMode === modeId) {
      setSelectedMode(null);
      setSelectedTopics([]);
      return;
    }

    setSelectedMode(modeId);
    setSelectedTopics([]);
  }

  function toggleTopic(topicId: TopicId) {
    clearLaunch();
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
      <header className="topbar">
        <div className="topbar-frame">
          <img
            className="topbar-art"
            src={topbarBySection[activeSection]}
            width="3840"
            height="328"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <button
            className="home-button"
            type="button"
            aria-label="ГЛАВНАЯ"
            aria-current={activeSection === 'home' ? 'page' : undefined}
            title="ГЛАВНАЯ"
            onClick={() => navigate('home')}
          />
          <nav className="nav" aria-label="Основная навигация">
            {sections.map((section) => (
              <button
                className={`nav-link${activeSection === section.id ? ' is-active' : ''}`}
                style={{'--tab-start': section.start} as CSSProperties}
                type="button"
                key={section.id}
                aria-current={activeSection === section.id ? 'page' : undefined}
                onClick={() => navigate(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {activeSection === 'home' ? trainingOpen && TrainingHub ? (
        <TrainingHub topics={selectedTopics} entry={trainingEntry} onExit={() => navigate('home')} />
      ) : (
        <main className="home-screen">
          <section className="mode-picker" aria-label="Выбор режима тренировки">
            <div className="mode-preview" aria-hidden="true">
              <img src={asset('main_home_picture.webp')} width="2048" height="1451" alt="" />
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
              onClick={startTraining}
              disabled={loadingTraining}
              aria-busy={loadingTraining}
              aria-describedby={startNotice ? 'start-notice' : undefined}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08)), url(${asset('background_play_button.webp')})`
              }}
            >
              {loadingTraining ? trainingEntry === 'progress' ? 'ОТКРЫВАЕМ ПРОГРЕСС…' : 'ОТКРЫВАЕМ ТЕСТ…' : 'НАЙТИ ИГРУ'}
            </button>
            {startNotice && <p className="start-notice" id="start-notice" role="status">{startNotice}</p>}
            <button className="home-progress-button" type="button" disabled={loadingTraining} onClick={() => openTraining('progress')}>
              МОЙ ПРОГРЕСС
              <span>Результаты и продолжение теста</span>
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
