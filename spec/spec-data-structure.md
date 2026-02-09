# Спецификация: Структура данных

## 1. База данных

### Таблица: users (Пользователи)
```
id                : integer (primary key, автоинкремент)
telegram_id       : bigint (уникальный, NOT NULL)
username          : string (nullable)
first_name        : string (nullable)
last_name         : string (nullable)
language_code     : string (default: 'ru')
role              : enum ('user', 'moderator', 'admin') (default: 'user')
is_blocked        : boolean (default: false)
is_banned         : boolean (default: false)
created_at        : timestamp (default: now())
updated_at        : timestamp (default: now())
last_activity_at  : timestamp (nullable)
```

**Индексы:**
- `telegram_id` (уникальный)
- `role`
- `created_at`

---

### Таблица: user_settings (Настройки пользователей)
```
id                    : integer (primary key)
user_id               : integer (foreign key -> users.id)
notifications_enabled : boolean (default: true)
timezone              : string (default: 'UTC')
language              : string (default: 'ru')
theme                 : enum ('light', 'dark') (default: 'light')
custom_settings       : jsonb (для дополнительных настроек)
created_at            : timestamp
updated_at            : timestamp
```

**Индексы:**
- `user_id` (уникальный)

---

### Таблица: [Ваша основная сущность - например, tasks]
Опишите структуру основных данных, с которыми работает бот:

```
id          : integer (primary key)
user_id     : integer (foreign key -> users.id)
title       : string (NOT NULL)
description : text (nullable)
status      : enum ('pending', 'in_progress', 'completed') (default: 'pending')
priority    : enum ('low', 'medium', 'high') (default: 'medium')
due_date    : timestamp (nullable)
created_at  : timestamp
updated_at  : timestamp
```

---

### Таблица: logs (Логи действий)
```
id            : integer (primary key)
user_id       : integer (foreign key -> users.id, nullable)
action        : string (NOT NULL)
command       : string (nullable)
parameters    : jsonb (nullable)
success       : boolean (default: true)
error_message : text (nullable)
ip_address    : string (nullable)
created_at    : timestamp
```

**Индексы:**
- `user_id`
- `action`
- `created_at`

---

## 2. Состояния диалога (FSM - Finite State Machine)

Если бот ведет многошаговые диалоги, опишите состояния:

```
IDLE                    - Ожидание команды
WAITING_FOR_NAME        - Ожидание ввода имени
WAITING_FOR_DESCRIPTION - Ожидание описания
WAITING_FOR_CATEGORY    - Выбор категории
CONFIRMING_ACTION       - Подтверждение действия
```

### Переходы между состояниями:
```
IDLE -> WAITING_FOR_NAME (команда /create)
WAITING_FOR_NAME -> WAITING_FOR_DESCRIPTION (получен текст)
WAITING_FOR_DESCRIPTION -> WAITING_FOR_CATEGORY (получен текст)
WAITING_FOR_CATEGORY -> CONFIRMING_ACTION (выбрана категория)
CONFIRMING_ACTION -> IDLE (подтверждение/отмена)

В любой момент: /cancel -> IDLE
```

---

## 3. Кэширование

Что нужно кэшировать для быстрой работы:

```
Ключ                              | TTL      | Описание
----------------------------------|----------|---------------------------
user:{telegram_id}:profile        | 1 час    | Данные профиля
user:{telegram_id}:settings       | 24 часа  | Настройки
user:{telegram_id}:permissions    | 1 час    | Права доступа
stats:daily:{date}                | 24 часа  | Статистика за день
active_users:count                | 5 минут  | Счетчик активных
```

---

## 4. Конфигурация бота

### Переменные окружения (.env файл)
```
# Telegram
BOT_TOKEN=your_bot_token_here
WEBHOOK_URL=https://yourdomain.com/webhook (если используется)

# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/botdb

# Redis (для кэша и состояний)
REDIS_URL=redis://localhost:6379

# Админы (telegram_id через запятую)
ADMIN_IDS=123456789,987654321

# Другие настройки
LOG_LEVEL=INFO
RATE_LIMIT_PER_MINUTE=20
MAX_FILE_SIZE_MB=10
TIMEZONE=Europe/Moscow
```

---

## 5. Формат ответов API

Если бот взаимодействует с вашим API:

### Успешный ответ:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "Название",
    "status": "active"
  },
  "message": "Операция выполнена успешно"
}
```

### Ответ с ошибкой:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Неверный формат данных",
    "details": {
      "field": "email",
      "issue": "Некорректный email адрес"
    }
  }
}
```

---

## 6. Валидация данных

### Правила валидации:

**Username:**
- Минимум 3 символа
- Максимум 32 символа
- Только латиница, цифры и underscore

**Описание:**
- Максимум 1000 символов
- Допустимы любые символы

**Email (если используется):**
- Стандартная email-валидация
- Проверка на существование домена (опционально)

**Файлы:**
- Максимальный размер: 10 MB
- Разрешенные форматы: .jpg, .png, .pdf, .docx

---

## Чеклист:
- [ ] Описаны все таблицы БД с типами полей
- [ ] Указаны индексы для оптимизации запросов
- [ ] Определены связи между таблицами (foreign keys)
- [ ] Описаны состояния FSM (если используется)
- [ ] Определена стратегия кэширования
- [ ] Перечислены все переменные окружения
- [ ] Описаны правила валидации данных
- [ ] Определен формат ответов API
