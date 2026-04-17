# ⚡ Быстрая шпаргалка по Deploy в Netlify

## Самый быстрый способ (3 команды)

```bash
npm run build     # Собрать проект (создает папку dist)
git add .         # Добавить изменения
git push          # Пушить на GitHub → Netlify автоматически задеплоит!
```

## Полный процесс

```bash
# 1. Тестирование локально
npm run dev               # Открой http://localhost:5173

# 2. Когда готово - сборка
npm run build             # Стандартная сборка
# или
npm run build:full        # С обфускацией кода (для продакшена)

# 3. Проверка
ls dist/                  # Проверь что папка создана
npm run preview           # Превью как будет выглядеть

# 4. Git
git status                # Посмотри что изменилось
git add .                 # Добавь всё
git commit -m "description"  # Commit с описанием
git push                  # Push

# ✅ Готово! Netlify сам соберет и задеплоит
```

## Важно помнить

| ✅ Делай | ❌ НЕ делай |
|---------|-----------|
| `npm run build` | Коммитить `dist/` в Git |
| `git push` | Коммитить `node_modules/` |
| Используй `npm install` | Вручную редактировать dist |
| Тестируй с `npm run dev` | Забывать про `.env` переменные |

## Если Netlify не обновляется

```bash
# Полная пересборка
rm -rf dist node_modules
npm install
npm run build
git add . && git commit -m "rebuild" && git push

# Или просто пересобрать
npm run build
git add . && git commit -m "build: update" && git push
```

## Проверка статуса на Netlify

1. Перейди на https://app.netlify.com
2. Выбери твой сайт
3. Посмотри **"Deploys"** - последний статус деплоя
4. Если красный статус - нажми на него и посмотри логи ошибок

---

**Главное:** Делай `git push` → Netlify сам всё соберет и задеплоит! 🚀
