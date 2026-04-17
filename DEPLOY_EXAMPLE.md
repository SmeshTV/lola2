# 📹 Пример реального процесса Deploy

## Сценарий: Ты сделал изменения в коде и хочешь их задеплоить

### Шаг 1️⃣: Проверка что всё работает локально

```bash
# Открой терминал в папке проекта
cd c:\Users\Arman\Desktop\lola

# Запусти локальный сервер
npm run dev

# В браузере открой http://localhost:5173
# Проверь что твои изменения работают
# Когда готово - Ctrl+C для выхода
```

**Результат:** Убедился что код работает ✅

---

### Шаг 2️⃣: Сборка проекта

```bash
# Собираем проект для продакшена
npm run build

# Вывод будет примерно такой:
# vite v5.4.2 building for production...
# ✓ 1234 modules transformed
# dist/index.html                 0.45 kB
# dist/assets/index-xxx.js       125.50 kB
# dist/assets/index-yyy.css       12.34 kB
# ✓ built in 12.34s

# Если ошибок - надо их исправить перед push!
```

**Результат:** Создана папка `dist/` с оптимизированным кодом ✅

---

### Шаг 3️⃣: Проверка что dist собрался

```bash
# Посмотри что создалось
dir dist

# Должны быть файлы:
# index.html
# 404.html (если настроен)
# assets/ (папка с js и css)

# Можешь также превью локально
npm run preview
# Откроется сайт как на Netlify
```

**Результат:** Убедился что dist скомпилирован правильно ✅

---

### Шаг 4️⃣: Git команды

```bash
# Посмотри что изменилось
git status

# Вывод:
# On branch main
# Changes not staged for commit:
#   modified: src/pages/Home.tsx
#   modified: src/components/Header.tsx
#
# Untracked files:
#   .env.local (может быть)
#
# ⚠️ ВАЖНО: dist/ НЕ должна быть в списке! (она в .gitignore)

# Добавь все изменения (кроме dist/)
git add .

# Проверь что добавилось правильно
git status

# Вывод должен быть:
# Changes to be committed:
#   modified: src/pages/Home.tsx
#   modified: src/components/Header.tsx
# 
# ⚠️ dist/ НЕ должна быть здесь!
```

**Результат:** Изменения подготовлены для commit ✅

---

### Шаг 5️⃣: Commit

```bash
# Создай commit с описанием
git commit -m "feat: добавлена новая страница профиля"

# Хорошие примеры commit сообщений:
# git commit -m "feat: добавлена новая страница"
# git commit -m "fix: исправлена ошибка в навбаре"
# git commit -m "style: изменен цвет кнопок"
# git commit -m "docs: обновлена документация"
# git commit -m "refactor: переписан код компонента"

# Вывод:
# [main f1a2b3c] feat: добавлена новая страница профиля
#  2 files changed, 145 insertions(+), 23 deletions(-)
```

**Результат:** Изменения залогированы в Git ✅

---

### Шаг 6️⃣: Push на GitHub

```bash
# Отправи изменения на GitHub
git push

# или если ветка не настроена:
git push origin main

# Вывод:
# Enumerating objects: 5, done.
# Counting objects: 100% (5/5), done.
# Delta compression using up to 8 threads
# Compressing objects: 100% (3/3), done.
# Writing objects: 100% (3/3), 456 bytes | 456.00 KiB/s, done.
# Total 3 (delta 2), reused 0 (delta 0), pack-reused 0
# To github.com:your-username/lola.git
#    abc1234..f1a2b3c  main -> main
```

**Результат:** Код отправлен на GitHub ✅

---

### Шаг 7️⃣: Netlify автоматический deploy

**Что происходит на Netlify автоматически:**

1. Netlify получает уведомление от GitHub
2. Клонирует твой репозиторий
3. Запускает `npm install`
4. Запускает `npm run build`
5. Берет папку `dist/` и деплоит её
6. Обновляет твой сайт на netlify.app

**Проверить статус:**

1. Перейди на https://app.netlify.com
2. Выбери свой сайт
3. Нажми **"Deploys"**
4. Посмотри статус последнего deploy:
   - 🟢 **Published** - успешно! Сайт обновлен
   - 🟡 **Building** - идет сборка
   - 🔴 **Failed** - ошибка (посмотри логи)

**Результат:** Твой сайт обновлен в интернете! 🚀

---

## 📊 Итоговый процесс (в одном окне)

```bash
cd c:\Users\Arman\Desktop\lola
npm run dev
# (тестируешь, потом Ctrl+C)

npm run build
npm run preview
# (проверяешь как выглядит)

git status
git add .
git status  # (проверяешь перед commit)
git commit -m "описание изменений"
git push

# ✅ ГОТОВО! Переди на https://app.netlify.com и смотри deploy!
```

---

## 🎯 Типичные вопросы

### "Сколько времени занимает deploy?"
Обычно 1-3 минуты. Проверь на Netlify → Deploys.

### "Когда я смогу увидеть изменения?"
После статуса "Published" на Netlify (может быть кэш - обнови браузер Ctrl+Shift+R)

### "Что если я вижу ошибку в коде уже после push?"
Исправь, пересобери, сделай еще один commit и push. Netlify снова задеплоит.

### "Как откатить на предыдущую версию?"
На Netlify в Deploys нажми на нужный deploy и выбери "Restore".

### "Может ли dist быть меньше?"
Да! Обнови `npm install` и пересобери - Vite автоматически оптимизирует.

---

## ✅ Чеклист "Готово ли к push?"

Перед `git push` убедись:

- [ ] Тестировал локально с `npm run dev`
- [ ] Нет ошибок в консоли браузера
- [ ] Собрал проект с `npm run build` без ошибок
- [ ] Проверил `npm run preview`
- [ ] `git status` показывает нужные файлы
- [ ] `dist/` НЕ в списке git (она в .gitignore)
- [ ] Commit сообщение понятное и короткое

Если всё ✅ - делай `git push` и поздравляем! 🎉
