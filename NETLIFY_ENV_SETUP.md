# 🔐 Настройка переменных окружения в Netlify

## Почему это важно

Когда Netlify собирает твой проект, он не имеет доступа к локальному `.env` файлу. Поэтому нужно добавить переменные окружения в настройки Netlify.

## Как добавить переменные окружения

### Способ 1: Через веб-интерфейс Netlify

1. Перейди на https://app.netlify.com
2. Выбери твой сайт
3. Нажми **"Site settings"**
4. Слева выбери **"Build & deploy"** → **"Environment"**
5. Нажми **"Edit variables"**
6. Добавь переменные (см. список ниже)
7. Нажми **"Save"**
8. Перестарт деплоя: **Deploys** → **Trigger deploy**

### Способ 2: Через Netlify CLI

```bash
# Установи Netlify CLI
npm install -g netlify-cli

# Авторизуйся
netlify login

# Добавь переменные (интерактивно)
netlify env:set VITE_SUPABASE_URL https://cuycmwfqaywlsxeqcbrm.supabase.co
netlify env:set VITE_SUPABASE_ANON_KEY eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Проверь переменные
netlify env:list
```

## Переменные которые нужны для LOLA

| Переменная | Значение | Источник |
|-----------|----------|----------|
| `VITE_SUPABASE_URL` | URL твоего Supabase проекта | supabase.com → проект → Project Settings |
| `VITE_SUPABASE_ANON_KEY` | Публичный API key | supabase.com → Settings → API |
| `SUPABASE_URL` | URL твоего Supabase проекта | (то же что выше) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (скрытый ключ) | supabase.com → Settings → API |
| `DISCORD_TOKEN` | Discord bot token | discord.com/developers → Bot → TOKEN |
| `DISCORD_BOT_TOKEN` | (то же что DISCORD_TOKEN) | discord.com/developers |
| `CLIENT_ID` | Discord app client ID | discord.com/developers → General Information |
| `GUILD_ID` | ID твоего Discord сервера | Включи Developer Mode в Discord → Правый клик на сервер → Copy Server ID |
| `DISCORD_GUILD_ID` | (то же что GUILD_ID) | (то же что выше) |
| `VITE_WARNINGS_WEBHOOK_URL` | Webhook URL для предупреждений | discord.com → сервер → канал → интеграции |

## ⚠️ БЕЗОПАСНОСТЬ

**НИКОГДА не коммитьте приватные ключи в Git!**

- `.env` в `.gitignore` - хорошо ✅
- `.env.example` без значений - хорошо ✅
- `.env` скопирован в Git - плохо ❌

## Получение значений переменных

### Supabase ключи

1. Перейди на https://supabase.com
2. Выбери свой проект
3. Нажми **"Settings"** (шестерня)
4. Выбери **"API"**
5. Скопируй:
   - `VITE_SUPABASE_URL` из "Project URL"
   - `VITE_SUPABASE_ANON_KEY` из "anon public"
   - `SUPABASE_SERVICE_ROLE_KEY` из "service_role secret"

### Discord токены

1. Перейди на https://discord.com/developers/applications
2. Выбери/создай приложение
3. **General Information**:
   - Скопируй `CLIENT_ID`
4. **Bot** tab:
   - Нажми "Reset Token"
   - Скопируй `DISCORD_TOKEN`

### Discord сервер ID

1. В Discord включи **Developer Mode** (User Settings → Advanced → Developer Mode)
2. Правый клик на сервер → **Copy Server ID**
3. Это твой `GUILD_ID`

### Webhook URL

1. Discord → правый клик на канал → **Edit Channel**
2. **Integrations** → **Webhooks**
3. **New Webhook** → Copy URL
4. Это твой `VITE_WARNINGS_WEBHOOK_URL`

## Проверка что всё работает

```bash
# После деплоя открой консоль браузера (F12)
# Если нет ошибок подключения - всё ок!

# Или проверь логи Netlify:
# Site → Deploys → нажми на deploy → Build log
```

## Если после деплоя ошибка подключения

1. Убедись что переменные правильно скопированы в Netlify (нет пробелов, верный формат)
2. Перестарт деплоя:
   - **Deploys** → **Trigger deploy** → **Deploy site**
3. Проверь логи сборки на ошибки
4. Проверь консоль браузера (F12) на ошибки подключения

---

**Важно:** После изменения переменных окружения нужно перезапустить деплой, чтобы они подхватились!
