import {useEffect, useState} from 'react';
import {asset, itemById} from './itemShop';
import type {ShopItem} from './types';

export function RecipeDiagram({item, onSelect, onBack}: {item: ShopItem; onSelect: (id: number) => void; onBack?: () => void}) {
  const [variant, setVariant] = useState(0);
  useEffect(() => setVariant(0), [item.id]);
  const variants = item.recipe?.variants ?? (item.recipe ? [item.recipe.components] : []);
  const components = [...(variants[variant] ?? variants[0] ?? []), ...(item.recipe?.scroll ? [item.recipe.scroll] : [])];
  return <section className="item-recipe" aria-label={`Сборка ${item.name}`}>
    {onBack && <button type="button" className="recipe-back" onClick={onBack} aria-label="Вернуться к предыдущему предмету" title="Назад">‹</button>}
    {variants.length > 1 && <select className="recipe-variant" aria-label="Вариант сборки" value={Math.min(variant, variants.length - 1)} onChange={event => setVariant(Number(event.target.value))}>
      {variants.map((_, index) => <option key={index} value={index}>Вариант {index + 1}</option>)}
    </select>}
    <div className={`recipe-diagram${components.length ? '' : ' recipe-single'}`}>
      {components.length > 0 && <svg className="recipe-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {components.map((_, index) => <path key={index} d={`M 50 27 L 50 45 L ${(index + .5) * 100 / components.length} 72`} />)}
      </svg>}
      <img className="recipe-result" src={asset(`icons/${item.icon}`)} width="88" height="64" alt={item.name} />
      {components.length > 0 && <div className="recipe-components">
        {components.map((id, index) => {
          const component = itemById.get(id)!;
          return <button type="button" className="recipe-component" key={`${id}-${index}`} onClick={() => onSelect(id)} title={component.name} aria-label={`Открыть ${component.name}`}>
            <img src={asset(`icons/${component.icon}`)} width="88" height="64" alt="" />
          </button>;
        })}
      </div>}
    </div>
  </section>;
}
