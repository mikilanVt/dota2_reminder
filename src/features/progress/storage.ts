import {emptyProgress, parseProgress, type ProgressData} from './model.js';

export const STORAGE_KEY = 'dotareminder.progress.v1';
export interface ProgressStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function createProgressStore(storage: ProgressStorage | null) {
  let memory = emptyProgress();
  let memoryOnly = storage === null;
  const warning = 'Браузер не разрешил сохранить прогресс. Он доступен до перезагрузки страницы; скачай копию, чтобы не потерять результаты.';
  return {
    read(): {data: ProgressData; notice: string} {
      if (memoryOnly) return {data: memory, notice: warning};
      try {
        const text = storage!.getItem(STORAGE_KEY);
        memory = text === null ? emptyProgress() : parseProgress(text);
        return {data: memory, notice: ''};
      } catch {
        // Preserve new in-memory answers after a quota/security failure instead
        // of loading an older disk copy on every return to the main menu.
        memoryOnly = true;
        return {data: memory, notice: 'Не удалось прочитать сохранение. ' + warning};
      }
    },
    write(data: ProgressData): string {
      memory = data;
      if (!storage) return warning;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        memoryOnly = false;
        return '';
      } catch {memoryOnly = true; return warning;}
    },
    clear(): string {
      memory = emptyProgress();
      if (!storage) return warning;
      try {storage.removeItem(STORAGE_KEY); memoryOnly = false; return '';}
      catch {
        // Some browsers allow replacement but not removal of a key.
        try {storage.setItem(STORAGE_KEY, JSON.stringify(memory)); memoryOnly = false; return '';}
        catch {memoryOnly = true; return 'Не удалось удалить сохранение из браузера. Удали данные сайта в настройках браузера; старая копия может вернуться после перезагрузки.';}
      }
    }
  };
}

let browserStore: ReturnType<typeof createProgressStore> | undefined;
export function getProgressStore() {
  if (!browserStore) {
    let storage: ProgressStorage | null = null;
    try {storage = window.localStorage;} catch { /* Training remains available. */ }
    browserStore = createProgressStore(storage);
  }
  return browserStore;
}
