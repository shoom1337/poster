# Спецификация: Структура данных

## 1. База данных (PostgreSQL 15+)

### Таблица: users (Пользователь-администратор)
```prisma
model User {
  id              Int       @id @default(autoincrement())
  telegram_id     BigInt    @unique
  username        String?
  first_name      String?
  last_name       String?
  timezone        String    @default("Europe/Moscow")
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  last_activity_at DateTime?

  // Relations
  action_logs     ActionLog[]
}
```

**Индексы:**
- `telegram_id` (unique) - для быстрой авторизации
- `last_activity_at` - для мониторинга активности

**Примечания:**
- В системе только один администратор
- `telegram_id` проверяется при каждом запросе
- `timezone` используется для корректного отображения времени

---

### Таблица: channels (Telegram-каналы для публикации)
```prisma
model Channel {
  id              Int       @id @default(autoincrement())
  channel_id      BigInt    @unique
  channel_username String?
  channel_title   String
  is_active       Boolean   @default(true)
  date_added      DateTime  @default(now())
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  // Relations
  posts           Post[]
}
```

**Индексы:**
- `channel_id` (unique)
- `is_active` - для фильтрации активных каналов
- `date_added` - для сортировки по дате добавления

**Примечания:**
- `is_active` = false при удалении канала (soft delete)
- `channel_id` - ID канала из Telegram API
- `channel_username` может быть null (если канал приватный)

---

### Таблица: posts (Публикации)
```prisma
model Post {
  id              Int       @id @default(autoincrement())
  channel_id      Int
  text            String    @db.Text
  status          PostStatus @default(DRAFT)
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  published_at    DateTime?
  telegram_message_id BigInt? // ID сообщения в канале после публикации

  // Relations
  channel         Channel   @relation(fields: [channel_id], references: [id])
  media           Media[]
  buttons         PostButton[]
  schedule        Schedule?
  statistics      PostStatistics?
  action_logs     ActionLog[]
}

enum PostStatus {
  DRAFT       // Черновик
  SCHEDULED   // Запланировано
  PUBLISHED   // Опубликовано
  FAILED      // Ошибка публикации
}
```

**Индексы:**
- `channel_id` - для выборки постов по каналу
- `status` - для фильтрации по статусу
- `created_at` - для сортировки
- `published_at` - для статистики и фильтров

**Примечания:**
- `text` хранится с HTML-форматированием
- `telegram_message_id` заполняется после успешной публикации
- `status` меняется автоматически планировщиком

---

### Таблица: media (Медиафайлы к публикациям)
```prisma
model Media {
  id              Int       @id @default(autoincrement())
  post_id         Int
  file_id         String    // file_id от Telegram
  file_type       MediaType
  file_size       Int?      // размер в байтах
  file_unique_id  String?   // unique_file_id от Telegram
  caption         String?   @db.Text
  position        Int       @default(0) // порядок в media group
  created_at      DateTime  @default(now())

  // Relations
  post            Post      @relation(fields: [post_id], references: [id], onDelete: Cascade)
}

enum MediaType {
  PHOTO
  VIDEO
  DOCUMENT
  ANIMATION
}
```

**Индексы:**
- `post_id` - для выборки медиа по посту
- `position` - для сортировки в media group

**Примечания:**
- `file_id` используется для отправки файла в Telegram (не нужно хранить файл на сервере)
- `position` определяет порядок отображения в media group (0, 1, 2...)
- `caption` - подпись к отдельному медиафайлу (опционально)
- Удаление поста каскадно удаляет все связанные медиа

---

### Таблица: post_buttons (Inline-кнопки под публикацией)
```prisma
model PostButton {
  id              Int       @id @default(autoincrement())
  post_id         Int
  text            String    // текст на кнопке
  url             String    // ссылка
  row             Int       @default(0) // номер ряда (0, 1, 2...)
  position        Int       @default(0) // позиция в ряду (0, 1, 2...)
  created_at      DateTime  @default(now())

  // Relations
  post            Post      @relation(fields: [post_id], references: [id], onDelete: Cascade)
}
```

**Индексы:**
- `post_id` - для выборки кнопок по посту
- Составной индекс `(post_id, row, position)` для правильной сортировки

**Примечания:**
- `row` - номер ряда (0 = первый ряд, 1 = второй ряд и т.д.)
- `position` - позиция кнопки в ряду (0 = первая слева, 1 = вторая и т.д.)
- Пример: row=0, position=0 → первая кнопка в первом ряду
- Пример: row=0, position=1 → вторая кнопка в первом ряду
- Пример: row=1, position=0 → первая кнопка во втором ряду
- Telegram ограничивает до 8 кнопок на ряд
- Удаление поста каскадно удаляет все кнопки

---

### Таблица: schedules (Расписание публикаций)
```prisma
model Schedule {
  id              Int       @id @default(autoincrement())
  post_id         Int       @unique
  scheduled_at    DateTime
  published_at    DateTime?
  status          ScheduleStatus @default(PENDING)
  attempts        Int       @default(0) // количество попыток публикации
  last_error      String?   @db.Text
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  // Relations
  post            Post      @relation(fields: [post_id], references: [id], onDelete: Cascade)
}

enum ScheduleStatus {
  PENDING     // Ожидает публикации
  PUBLISHED   // Опубликовано
  FAILED      // Ошибка публикации
  CANCELLED   // Отменено
}
```

**Индексы:**
- `post_id` (unique) - один пост = одно расписание
- `scheduled_at` - для выборки предстоящих публикаций
- `status` - для фильтрации
- Составной индекс `(status, scheduled_at)` для планировщика

**Примечания:**
- Планировщик выбирает записи со статусом PENDING и scheduled_at <= now()
- `attempts` увеличивается при каждой неудачной попытке
- После 3 неудачных попыток статус меняется на FAILED
- `last_error` хранит последнее сообщение об ошибке

---

### Таблица: post_statistics (Статистика публикаций)
```prisma
model PostStatistics {
  id              Int       @id @default(autoincrement())
  post_id         Int       @unique
  views_count     Int       @default(0)
  forwards_count  Int       @default(0)
  reactions_count Int       @default(0)
  last_updated_at DateTime  @default(now())
  created_at      DateTime  @default(now())

  // Relations
  post            Post      @relation(fields: [post_id], references: [id], onDelete: Cascade)
}
```

**Индексы:**
- `post_id` (unique)
- `last_updated_at` - для отслеживания времени обновления

**Примечания:**
- Создаётся автоматически после публикации поста
- Обновляется cron-job'ом каждые 1-6 часов
- Данные берутся из Telegram API методом `getChat` или через forward

---

### Таблица: action_logs (Логи действий пользователя)
```prisma
model ActionLog {
  id              Int       @id @default(autoincrement())
  user_id         Int?
  action          String    // тип действия
  entity_type     String?   // тип сущности (post, channel, etc)
  entity_id       Int?      // ID сущности
  parameters      Json?     // дополнительные параметры
  success         Boolean   @default(true)
  error_message   String?   @db.Text
  created_at      DateTime  @default(now())

  // Relations
  user            User?     @relation(fields: [user_id], references: [id])
}
```

**Индексы:**
- `user_id` - для выборки действий пользователя
- `action` - для фильтрации по типу действия
- `created_at` - для сортировки по времени
- `entity_type, entity_id` - для поиска действий с конкретной сущностью

**Примечания:**
- `action` примеры: 'post_created', 'post_updated', 'post_deleted', 'post_published', 'channel_added', 'channel_removed'
- `parameters` может содержать: старые значения (для отката), детали ошибки и т.д.
- `user_id` может быть null для системных действий (планировщик, cron)

---

## 2. Состояния диалога (FSM - Finite State Machine)

Используется библиотека `@grammyjs/conversations` для многошаговых диалогов.

### Состояния для создания публикации:

```typescript
enum CreatePostState {
  SELECTING_CHANNEL = 'selecting_channel',
  ENTERING_TEXT = 'entering_text',
  ADDING_MEDIA = 'adding_media',
  ADDING_BUTTONS = 'adding_buttons',
  SCHEDULING = 'scheduling',
  SELECTING_DATE = 'selecting_date',
  SELECTING_HOUR = 'selecting_hour',
  SELECTING_MINUTES = 'selecting_minutes',
  PREVIEW = 'preview',
  COMPLETED = 'completed',
}
```

### Переходы между состояниями:

```
IDLE → SELECTING_CHANNEL (/newpost)
SELECTING_CHANNEL → ENTERING_TEXT (выбран канал)
ENTERING_TEXT → ADDING_MEDIA (введён текст)
ADDING_MEDIA → ADDING_BUTTONS (добавлены медиа или пропущено)
ADDING_BUTTONS → SCHEDULING (добавлены кнопки или пропущено)
SCHEDULING → SELECTING_DATE (выбрано "Запланировать")
SCHEDULING → PREVIEW (выбрано "Сейчас")
SCHEDULING → COMPLETED (выбрано "Сохранить как черновик")
SELECTING_DATE → SELECTING_HOUR (выбрана дата)
SELECTING_HOUR → SELECTING_MINUTES (выбран час)
SELECTING_MINUTES → PREVIEW (выбраны минуты)
PREVIEW → COMPLETED (подтверждено)
PREVIEW → ENTERING_TEXT (выбрано "Редактировать")

В любой момент: /cancel → COMPLETED (отмена)
```

### Состояния для редактирования публикации:

```typescript
enum EditPostState {
  SELECTING_POST = 'selecting_post',
  EDIT_MENU = 'edit_menu',
  EDITING_CHANNEL = 'editing_channel',
  EDITING_TEXT = 'editing_text',
  EDITING_MEDIA = 'editing_media',
  EDITING_BUTTONS = 'editing_buttons',
  EDITING_TIME = 'editing_time',
  PREVIEW = 'preview',
  COMPLETED = 'completed',
}
```

---

## 3. Кэширование (Redis)

### Структура ключей Redis:

```
Ключ                                    | TTL        | Описание
----------------------------------------|------------|---------------------------
conversation:{user_id}:state            | 1 час      | Состояние conversation
conversation:{user_id}:data             | 1 час      | Данные conversation (текст, медиа, и т.д.)
channel:{channel_id}:info               | 24 часа    | Информация о канале (title, username)
post:{post_id}:preview                  | 10 минут   | Превью поста для быстрого отображения
stats:cache:{post_id}                   | 30 минут   | Кэш статистики поста
scheduler:lock                          | 1 минута   | Блокировка для планировщика (один процесс)
admin:{telegram_id}:notifications       | бессрочно  | Настройки уведомлений админа
```

### Примеры данных в Redis:

**Состояние conversation:**
```json
{
  "state": "ENTERING_TEXT",
  "channel_id": 123,
  "started_at": 1707912000000
}
```

**Данные conversation:**
```json
{
  "channel_id": 123,
  "text": "<b>Заголовок</b> публикации",
  "media": [
    {
      "file_id": "AgACAgIAAxkBAAID...",
      "file_type": "photo",
      "position": 0
    }
  ],
  "buttons": [
    {
      "text": "Перейти на сайт",
      "url": "https://example.com",
      "row": 0,
      "position": 0
    }
  ],
  "scheduled_at": "2024-02-15T10:00:00Z"
}
```

---

## 4. Конфигурация бота (.env файл)

```bash
# Telegram
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_TELEGRAM_ID=123456789

# База данных
DATABASE_URL=postgresql://poster_user:password@localhost:5432/poster_db

# Redis (для conversations и кэша)
REDIS_URL=redis://localhost:6379

# SMTP (Email уведомления)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Poster Bot <your_email@gmail.com>
SMTP_TO=admin@example.com

# Логирование
LOG_LEVEL=info
LOG_DIR=./logs

# Планировщик
SCHEDULER_INTERVAL=* * * * * # каждую минуту (cron format)
STATS_SYNC_INTERVAL=0 */3 * * * # каждые 3 часа (cron format)

# Безопасность
MAX_FILE_SIZE_MB=10
MAX_TEXT_LENGTH=4096
CONVERSATION_TIMEOUT_MS=300000 # 5 минут

# Timezone
TZ=Europe/Moscow
DEFAULT_TIMEZONE=Europe/Moscow

# Мониторинг
HEALTHCHECK_PORT=3000
HEALTHCHECK_PATH=/health

# Backup
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=7
```

---

## 5. Валидация данных

### Правила валидации:

**Текст публикации:**
- Минимум: 1 символ
- Максимум: 4096 символов (ограничение Telegram)
- HTML теги валидируются (должны быть корректно закрыты)
- Допустимые теги: `<b>`, `<i>`, `<u>`, `<code>`, `<pre>`, `<a>`, `<spoiler>`

**Медиафайлы:**
- Максимум файлов в одной публикации: 10
- Максимальный размер фото: 10 MB
- Максимальный размер видео: 50 MB
- Максимальный размер документа: 50 MB
- Допустимые типы: photo, video, document, animation

**URL кнопок:**
- Должен начинаться с `http://` или `https://`
- Валидация по регулярному выражению
- Максимальная длина: 2048 символов

**Текст кнопок:**
- Минимум: 1 символ
- Максимум: 64 символа (ограничение Telegram)
- Нельзя использовать emoji в качестве единственного символа

**Username канала:**
- Формат: `@channel_name` или `channel_name`
- Только латиница, цифры и underscore
- Минимум 5 символов
- Максимум 32 символа

**Дата и время:**
- Не может быть в прошлом (для новых публикаций)
- Минимум: текущее время + 1 минута
- Максимум: +1 год от текущего времени
- Формат: ISO 8601 (2024-02-15T10:00:00Z)

---

## 6. Структура данных в Conversations

Данные, которые хранятся в контексте conversation во время создания/редактирования публикации:

```typescript
interface PostConversationData {
  // Основные данные
  postId?: number; // для редактирования
  channelId: number;
  text: string;

  // Медиа
  media: Array<{
    fileId: string;
    fileType: 'photo' | 'video' | 'document';
    fileSize?: number;
    position: number;
  }>;

  // Кнопки
  buttons: Array<{
    text: string;
    url: string;
    row: number;
    position: number;
  }>;

  // Расписание
  scheduledAt?: Date;
  publishNow: boolean;
  saveAsDraft: boolean;

  // Метаданные
  startedAt: number;
  currentStep: CreatePostState | EditPostState;
}
```

---

## 7. Формат ответов Telegram Bot API

### Успешная публикация:
```typescript
interface TelegramMessageResponse {
  ok: true;
  result: {
    message_id: number;
    chat: {
      id: number;
      title: string;
      username?: string;
      type: 'channel';
    };
    date: number;
    text?: string;
    caption?: string;
  };
}
```

### Ошибка публикации:
```typescript
interface TelegramErrorResponse {
  ok: false;
  error_code: number;
  description: string;
  // Примеры:
  // error_code: 403, description: "Forbidden: bot is not a member of the channel"
  // error_code: 400, description: "Bad Request: message text is empty"
}
```

### Получение статистики:
```typescript
interface TelegramChatResponse {
  ok: true;
  result: {
    id: number;
    type: 'channel';
    title: string;
    username?: string;
    // Для получения просмотров используется метод getUpdates
    // или forward message в приватный чат и проверка views
  };
}
```

---

## 8. Структура логов (Winston)

### Формат логов:

```json
{
  "level": "info",
  "message": "Post published successfully",
  "timestamp": "2024-02-14T15:30:00.000Z",
  "context": {
    "postId": 123,
    "channelId": 456,
    "messageId": 789,
    "scheduledAt": "2024-02-14T15:30:00.000Z"
  }
}
```

### Уровни логирования:

- **error**: Критические ошибки (DB connection lost, Telegram API errors)
- **warn**: Предупреждения (retry attempts, deprecated functions)
- **info**: Информационные сообщения (post published, channel added)
- **debug**: Отладочная информация (conversation state changes, API calls)

### Файлы логов:

```
/logs
  /error-2024-02-14.log     # Только ошибки
  /combined-2024-02-14.log  # Все логи
  /application-2024-02-14.log # Общие логи приложения
```

Ротация: ежедневно, хранение 14 дней

---

## Чеклист:
- [x] Описаны все таблицы БД с типами полей
- [x] Указаны индексы для оптимизации запросов
- [x] Определены связи между таблицами (foreign keys)
- [x] Описаны состояния FSM для conversations
- [x] Определена стратегия кэширования (Redis)
- [x] Перечислены все переменные окружения
- [x] Описаны правила валидации данных
- [x] Определен формат ответов Telegram API
- [x] Добавлена структура inline-кнопок (PostButton)
- [x] Описана структура данных для conversations
- [x] Добавлен формат логов
