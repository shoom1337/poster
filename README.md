# Telegram Poster Bot

Telegram-бот для автоматизации отложенных публикаций в каналы с аналитикой.

## Возможности

- ✅ Создание и редактирование публикаций
- ✅ Планирование времени публикации
- ✅ Поддержка медиафайлов (фото, видео, документы)
- ✅ Inline-кнопки под постами
- ✅ Управление несколькими каналами
- ✅ Статистика по постам (просмотры, пересылки)
- ✅ Черновики
- ✅ Календарь публикаций

## Технологии

- **Node.js** 18+ с TypeScript 5.3+
- **Grammy** - фреймворк для Telegram Bot API
- **PostgreSQL** 15+ - основная база данных
- **Redis** 7 - кеширование сессий
- **Prisma** - ORM
- **Docker** - контейнеризация

## Требования

- Node.js 18+ LTS
- PostgreSQL 15+
- Redis 7+
- Docker и Docker Compose (опционально)

## Установка

### 1. Клонирование репозитория

```bash
cd poster
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните необходимые значения:

```env
# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
ADMIN_TELEGRAM_ID=your_telegram_id_here

# Database Configuration
DATABASE_URL=postgresql://poster_user:changeme@localhost:5432/poster_db
POSTGRES_PASSWORD=changeme

# Redis Configuration
REDIS_URL=redis://localhost:6379

# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@example.com

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
HEALTHCHECK_PORT=3000
```

**Как получить данные:**

1. **BOT_TOKEN**: Создайте бота через [@BotFather](https://t.me/BotFather) командой `/newbot`
2. **ADMIN_TELEGRAM_ID**: Узнайте свой ID через [@userinfobot](https://t.me/userinfobot)

### 4. Инициализация базы данных

```bash
# Генерация Prisma Client
npm run prisma:generate

# Применение миграций
npm run prisma:migrate
```

### 5. Запуск

**Режим разработки (с hot reload):**

```bash
npm run dev
```

**Production:**

```bash
# Сборка
npm run build

# Запуск
npm start
```

## Запуск с Docker

### 1. Подготовка

Создайте файл `.env` как описано выше. Для Docker используйте следующие настройки:

```env
DATABASE_URL=postgresql://poster_user:changeme@postgres:5432/poster_db
REDIS_URL=redis://redis:6379
```

### 2. Запуск

```bash
cd docker
docker-compose up -d
```

### 3. Инициализация БД (первый запуск)

```bash
docker-compose exec bot npx prisma migrate deploy
```

### 4. Просмотр логов

```bash
docker-compose logs -f bot
```

### 5. Остановка

```bash
docker-compose down
```

## Использование

### Первый запуск

1. Запустите бота
2. Отправьте команду `/start` в личные сообщения бота
3. Используйте `/channels` для добавления каналов
4. Добавьте бота в канал как администратора
5. Перешлите любое сообщение из канала боту для регистрации

### Основные команды

- `/start` - Приветствие и описание
- `/help` - Справка по командам
- `/newpost` - Создать новую публикацию
- `/editpost` - Редактировать публикацию
- `/drafts` - Список черновиков
- `/schedule` - Календарь публикаций
- `/statistics` - Статистика по постам
- `/channels` - Управление каналами
- `/cancel` - Отменить текущее действие

### Создание публикации

1. `/newpost` - начать создание
2. Выберите канал
3. Введите текст (поддерживается HTML-форматирование)
4. Добавьте медиафайлы (опционально)
5. Добавьте кнопки (опционально)
6. Выберите время публикации
7. Подтвердите и опубликуйте

## Структура проекта

```
/poster-bot
├── /src
│   ├── /bot              # Grammy bot handlers
│   │   ├── /commands     # Команды (/start, /help, etc)
│   │   ├── /conversations# Диалоги (создание/редактирование)
│   │   ├── /keyboards    # Inline/Reply клавиатуры
│   │   └── /middlewares  # Авторизация, логирование
│   ├── /scheduler        # Cron jobs
│   │   ├── publisher.ts  # Публикация по расписанию
│   │   └── statistics.ts # Синхронизация статистики
│   ├── /services         # Business logic
│   │   ├── postService.ts
│   │   ├── channelService.ts
│   │   ├── statsService.ts
│   │   └── notificationService.ts
│   ├── /prisma           # DB schema & migrations
│   │   └── schema.prisma
│   ├── /utils            # Helpers
│   │   ├── logger.ts
│   │   ├── validators.ts
│   │   └── formatters.ts
│   └── index.ts          # Entry point
├── /docker
│   ├── Dockerfile
│   └── docker-compose.yml
├── /scripts
│   ├── backup.sh         # Backup PostgreSQL
│   └── restore.sh        # Restore from backup
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Резервное копирование

### Автоматический backup

Бэкапы PostgreSQL создаются автоматически каждый день в 3:00 через cron job.

### Ручной backup

```bash
npm run backup
```

### Восстановление

```bash
npm run restore
```

## Мониторинг

### Healthcheck

Бот предоставляет HTTP endpoint для проверки здоровья:

```bash
curl http://localhost:3000/health
```

Ответ:

```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Логи

Логи сохраняются в папку `logs/`:

- `app-YYYY-MM-DD.log` - все логи
- `error-YYYY-MM-DD.log` - только ошибки

## Troubleshooting

### Бот не отвечает

1. Проверьте логи: `docker-compose logs bot`
2. Убедитесь, что BOT_TOKEN правильный
3. Проверьте подключение к БД и Redis

### Ошибки базы данных

```bash
# Пересоздать БД
docker-compose down
docker-compose up -d postgres
docker-compose exec postgres psql -U poster_user -d postgres -c "DROP DATABASE IF EXISTS poster_db;"
docker-compose exec postgres psql -U poster_user -d postgres -c "CREATE DATABASE poster_db;"
docker-compose up -d bot
docker-compose exec bot npx prisma migrate deploy
```

### Проблемы с Redis

```bash
# Перезапустить Redis
docker-compose restart redis
```

## Разработка

### Запуск в режиме разработки

```bash
npm run dev
```

### Prisma Studio (GUI для БД)

```bash
npm run prisma:studio
```

Откроется в браузере на `http://localhost:5555`

### Создание миграции

```bash
npm run prisma:migrate
```

## Лицензия

MIT

## Контакты

По вопросам и предложениям создавайте issue в репозитории.
