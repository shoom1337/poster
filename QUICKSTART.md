# Quick Start Guide

## Быстрый запуск для разработки

### 1. Установка зависимостей

```bash
npm install
```

### 2. Создание .env файла

```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните:

- `BOT_TOKEN` - получите у [@BotFather](https://t.me/BotFather)
- `ADMIN_TELEGRAM_ID` - ваш ID от [@userinfobot](https://t.me/userinfobot)

### 3. Запуск БД через Docker

```bash
cd docker
docker-compose up -d postgres redis
```

### 4. Инициализация БД

```bash
npm run prisma:generate
npm run prisma:push
```

### 5. Запуск бота

```bash
npm run dev
```

Готово! Откройте бота в Telegram и отправьте `/start`

## Полезные команды

```bash
# Просмотр логов БД
docker-compose logs -f postgres

# Prisma Studio (GUI для БД)
npm run prisma:studio

# Перезапуск БД
docker-compose restart postgres redis

# Остановка всех сервисов
docker-compose down
```

## Решение проблем

### Порты заняты

Измените порты в `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"  # PostgreSQL
  - "6380:6379"  # Redis
```

И обновите `DATABASE_URL` и `REDIS_URL` в `.env`

### Ошибка подключения к БД

```bash
# Проверьте статус
docker-compose ps

# Перезапустите
docker-compose restart postgres

# Проверьте логи
docker-compose logs postgres
```
