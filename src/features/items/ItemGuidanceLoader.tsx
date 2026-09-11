import {useEffect, useState, type ComponentType} from 'react';
import type {ShopItem} from './types';

type Props = {item: ShopItem; onSelect: (id: number) => void};
let loaded: ComponentType<Props> | null = null;

export function ItemGuidanceLoader(props: Props) {
  const [Content, setContent] = useState<ComponentType<Props> | null>(() => loaded);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loaded) {setContent(() => loaded); return;}
    let active = true;
    setError(false);
    import('./ItemGuidance').then(module => {
      loaded = module.default;
      if (active) setContent(() => module.default);
    }).catch(() => {if (active) setError(true);});
    return () => {active = false;};
  }, [attempt]);
  if (Content) return <Content key={props.item.id} {...props} />;
  if (error) return <div className="item-guidance-loading" role="status"><p>Не удалось загрузить дополнительные сведения.</p><button type="button" className="item-small-button" onClick={() => setAttempt(value => value + 1)}>Повторить</button></div>;
  return <p className="item-guidance-loading" role="status">Загружаем дополнительные сведения…</p>;
}
