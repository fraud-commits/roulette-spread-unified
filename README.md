# Roulette Spread — объединённая версия

Самостоятельная рабочая копия для тестирования. Исходные папки `ROULETTE-main`, `DT-LAYOUT-main` и `AMERICAN-ROULETTE-main` не изменяются.

## Локальное демо

Откройте `index.html` через локальный HTTP-сервер (например, VS Code Live Server). Для запуска через Python из этой папки:

```powershell
python -m http.server 8000
```

Затем откройте `http://localhost:8000`.

- `http://localhost:8000/?demo=missing` — демо без колонки Winning Number.
- `http://localhost:8000/?demo=win` — демо с Winning Number.

На странице доступны переключатели колеса и валюты. Для проверки данных Tableau откройте расширение в Tableau: ожидается лист `work2` и колонки, описанные в `js/application.js`.
