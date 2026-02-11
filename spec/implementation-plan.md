# План реализации: Создание, редактирование, планирование и удаление постов

## Обзор

Реализация полного функционала управления постами для Telegram-бота @poster1337_bot:
- Создание постов с текстом, медиа, кнопками
- Планирование публикаций с выбором даты/времени
- Редактирование черновиков и запланированных постов
- Просмотр календаря публикаций (день/неделя/месяц)
- Дублирование и удаление постов

## Архитектурные решения

### 1. Использование @grammyjs/menu вместо conversations

**Подход:** Меню-ориентированная архитектура с управлением состоянием через Redis session

**Преимущества:**
- Лучший UX с inline keyboards
- Явное управление состоянием
- Простая навигация "назад"
- Полный контроль над UI

**Структура состояния:**
```typescript
interface SessionData {
  currentOperation?: 'newpost' | 'editpost' | 'schedule' | 'drafts';
  postDraft?: {
    id?: number;
    channelId?: number;
    text?: string;
    mediaFiles?: MediaFile[];
    buttons?: Button[];
    scheduledAt?: Date;
    status?: 'DRAFT' | 'SCHEDULED';
    step?: 'channel' | 'text' | 'media' | 'buttons' | 'time' | 'preview';
  };
  scheduleView?: {
    mode: 'days' | 'weeks' | 'months';
    currentDate: Date;
    filters?: { channelId?: number; status?: string };
  };
  awaitingInput?: {
    type: 'text' | 'media' | 'button';
    messageId: number;
  };
}
```

### 2. Библиотека календаря

**Решение:** Использовать `telegram-inline-calendar`

**Установка:**
```bash
npm install telegram-inline-calendar
```

**Причина:** Поддержка русской локализации, гибкая настройка, совместимость с Grammy

### 3. Формат callback data

Telegram ограничивает callback data 64 байтами. Используем короткие префиксы:

```
np_ch_12     - newpost: channel selected (id=12)
ep_12_txt    - editpost: edit text of post 12
sch_p_12_del - schedule: delete post 12
cal_20260215 - calendar: date selected
tim_10       - time: hour 10 selected
```

Полное состояние храним в session, в callback только ID и действие.

## Структура файлов

```
src/
├── bot/
│   ├── commands/
│   │   ├── newpost.ts          # /newpost - создание поста
│   │   ├── editpost.ts         # /editpost - редактирование
│   │   ├── drafts.ts           # /drafts - черновики
│   │   └── schedule.ts         # /schedule - календарь
│   ├── menus/
│   │   ├── postCreationMenu.ts # Меню создания поста
│   │   ├── postEditMenu.ts     # Меню редактирования
│   │   ├── scheduleMenu.ts     # Меню календаря
│   │   └── shared/
│   │       ├── channelSelector.ts  # Выбор канала (reusable)
│   │       ├── timeSelector.ts     # Выбор времени (reusable)
│   │       └── confirmDialog.ts    # Подтверждение (reusable)
│   ├── handlers/
│   │   ├── postCallbacks.ts    # Роутинг callback queries
│   │   ├── textInput.ts        # Обработка текстовых сообщений
│   │   ├── mediaInput.ts       # Обработка медиа
│   │   └── buttonInput.ts      # Обработка формата кнопок
│   ├── keyboards/
│   │   ├── calendarBuilder.ts  # Построение календаря
│   │   ├── timePickerBuilder.ts # Выбор часов/минут
│   │   └── paginationBuilder.ts # Пагинация
│   └── utils/
│       ├── sessionState.ts     # Хелперы для session state
│       ├── callbackData.ts     # Encode/decode callback data
│       └── messageBuilder.ts   # Построение сообщений
├── services/
│   └── scheduleQueryService.ts # Сложные запросы для календаря
└── types/
    └── session.ts              # TypeScript типы для session
```

## Этапы реализации

### Этап 1: Фундамент (1-2 дня) ✅ В ПРОЦЕССЕ

**Цель:** Настроить инфраструктуру и общие компоненты

**Задачи:**
1. ✅ Установить `telegram-inline-calendar`
2. Создать типы session (`src/types/session.ts`)
3. Создать хелперы:
   - `src/bot/utils/sessionState.ts` - работа с session
   - `src/bot/utils/callbackData.ts` - encode/decode
   - `src/bot/utils/messageBuilder.ts` - шаблоны сообщений
4. Создать reusable компоненты:
   - `src/bot/menus/shared/channelSelector.ts`
   - `src/bot/keyboards/paginationBuilder.ts`

**Тестирование:** Проверить чтение/запись session, пагинацию

### Этап 2-8: См. ниже

## Время реализации

**Общая оценка: 12-15 дней**

- Этап 1: 2 дня
- Этап 2: 3-5 дней
- Этап 3: 2-3 дня
- Этап 4: 1 день
- Этап 5: 3-4 дня
- Этап 6: 1 день
- Этап 7: 1-2 дня
- Этап 8: 1 день

## Критические спецификации

- **spec/spec-user-scenarios.md** - Полные сценарии использования с UI текстами
- **spec/spec-ui-messages.md** - Точные тексты сообщений на русском
- **prisma/schema.prisma** - Структура БД (Post, Media, PostButton, Schedule)
- **src/services/postService.ts** - Бизнес-логика
- **src/utils/validators.ts** - Валидация
- **src/utils/formatters.ts** - Форматирование
