# 📦 Инструкция по обновлению dist и публикации в Netlify

## 🔍 Важная информация

- Папка `dist/` находится в `.gitignore` - **это нормально!**
- Netlify **автоматически** собирает проект при каждом push
- Вам не нужно коммитить папку `dist/` в Git

---

## ✅ Правильный способ обновления и публикации

### Вариант 1️⃣: Локальная сборка + Push на GitHub (Рекомендуется)

```bash
# 1. Убедись что находишься в корне проекта
cd c:\Users\Arman\Desktop\lola

# 2. Установи зависимости (если нужно)
npm install

# 3. Проверь что всё работает локально
npm run dev
# Проверь приложение на http://localhost:5173

# 4. Собери проект для продакшена
npm run build
# или если нужна обфускация кода:
npm run build:full

# 5. Проверь что dist собрался правильно
# Должна появиться папка dist/ с файлами:
# - dist/index.html
# - dist/assets/
# - dist/404.html (если есть)

# 6. Добавь изменения в Git
git add .
# ⚠️ НЕ добавляй dist! Он уже в .gitignore

# 7. Создай commit
git commit -m "feat: описание изменений"

# 8. Push на GitHub
git push origin main
# (или git push если главная ветка настроена)

# Netlify автоматически:
# ✅ Заметит изменения на GitHub
# ✅ Запустит npm run build
# ✅ Обновит папку dist
# ✅ Задеплоит новую версию
```

### Вариант 2️⃣: Только изменение файлов dist (для быстрого деплоя)

Если ты быстро хочешь проверить, что dist обновился:

```bash
# 1. Собери проект
npm run build

# 2. Проверь что изменилось
git status

# 3. Если нужно пересобрать (очистить кэш)
rm -rf dist
npm run build

# 4. Push на GitHub
git add .
git commit -m "build: rebuild dist"
git push
```

---

## 🚀 Настройка Netlify (один раз)

Если Netlify еще не настроен:

### Вариант A: Через веб-интерфейс Netlify

1. Перейди на [netlify.com](https://netlify.com)
2. Нажми **"Add new site"** → **"Import an existing project"**
3. Выбери **GitHub** и авторизуйся
4. Выбери репозиторий `lola`
5. Настрой сборку:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Нажми **Deploy site**

### Вариант B: Через netlify.toml (лучше)

Создай файл `netlify.toml` в корне проекта:

```toml
[build]
command = "npm run build"
publish = "dist"

[build.environment]
NODE_VERSION = "20"

[[redirects]]
from = "/*"
to = "/index.html"
status = 200

[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=31536000"

[[headers]]
for = "/*"
[headers.values]
Cache-Control = "max-age=0, must-revalidate"
```

---

## 📋 Чеклист перед Deploy

- [ ] Все изменения локально протестированы (`npm run dev`)
- [ ] Нет ошибок в консоли браузера
- [ ] Переменные окружения установлены (`.env`)
- [ ] Проект собирается без ошибок (`npm run build`)
- [ ] dist папка создана и содержит файлы
- [ ] Не коммитишь node_modules
- [ ] Не коммитишь .env (только .env.example)

---

## 🔧 Команды для разработки

```bash
# Запустить локальный сервер
npm run dev

# Собрать для продакшена
npm run build

# Собрать с обфускацией кода
npm run build:full

# Превью собранного проекта локально
npm run preview

# Проверка типов TypeScript
npm run typecheck

# Проверка ESLint ошибок
npm run lint
```

---

## 🐛 Если что-то не работает

### dist не обновляется на Netlify

```bash
# 1. Очистить кэш
rm -rf node_modules dist
npm install

# 2. Пересобрать
npm run build

# 3. Проверить что файлы там
ls dist/

# 4. Push
git add .
git commit -m "fix: rebuild dist"
git push
```

### Netlify показывает старую версию

1. Перейди на https://app.netlify.com
2. Выбери сайт
3. Нажми **"Deploys"**
4. Нажми **"Clear cache and retry latest deploy"** (если есть)
5. Или нажми **"Trigger deploy"** → **"Deploy site"**

### Ошибка при сборке на Netlify

1. Проверь логи Netlify (Deploy tab)
2. Убедись что `.env` переменные установлены в Netlify:
   - Netlify → Site settings → Environment
   - Добавь все переменные из `.env.example`

---

## 📌 Важные моменты

✅ **Делай:**
- Push кода на GitHub → Netlify автоматически сложит
- Используй `git add .` перед commit
- Создавай понятные сообщения commit

❌ **Не делай:**
- Не коммить папку `dist/` (она в .gitignore)
- Не коммить `node_modules/` 
- Не коммить `.env` файл
- Не пушить напрямую в dist через Netlify UI

---

## 🔗 Ссылки

- Netlify docs: https://docs.netlify.com/
- Vite deploy: https://vitejs.dev/guide/static-deploy.html
- GitHub integration: https://docs.netlify.com/integrations/github/
