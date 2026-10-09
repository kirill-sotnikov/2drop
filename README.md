# 2drop

Монорепозиторий на Yarn с workspaces `service` и `web`.
В `web` используются Next.js App Router, React, TypeScript и vanilla-extract.

## Разработка

```sh
yarn install
yarn dev
```

Приложение доступно на http://localhost:3000.

## Проверка и сборка

```sh
yarn typecheck
yarn build
yarn start
```

`typecheck` проверяет оба workspace. `build` и `start` собирают и запускают `web`.
Эти команды также доступны напрямую через `yarn workspace web <команда>`.

Стили находятся в `web/src/app/*.css.ts` и компилируются vanilla-extract через
Webpack. Next.js настроен на транспиляцию TypeScript из workspace `service`.

## Линтинг и форматирование

```sh
yarn lint
yarn lint:fix
yarn format:check
yarn format
```

ESLint использует рекомендуемые правила JavaScript и TypeScript для обоих
workspaces, а также Next.js Core Web Vitals для `web`. Prettier отвечает за
форматирование; `eslint-config-prettier` отключает конфликтующие правила ESLint.
Конфигурации находятся в корне проекта. Во всех пакетах используется TypeScript 6.0.3.
