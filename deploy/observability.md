# Наблюдаемость signaling

Приложение пишет логи в stdout через Pino и предоставляет `GET /metrics` в формате
Prometheus на HTTP-порту signaling. Pino и prom-client работают внутри приложения;
Loki, Alloy, Prometheus и Grafana запускаются отдельно.

## Конфигурация

```dotenv
LOG_LEVEL=info
NODE_ENV=production
APP_VERSION=release-or-commit-sha
METRICS_TOKEN=replace-with-a-random-token
```

`LOG_LEVEL` принимает `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`.
Уровень логов не влияет на метрики. При пустом `METRICS_TOKEN` маршрут не требует
авторизации, что удобно локально. При непустом значении нужен заголовок
`Authorization: Bearer <token>`; неверный или отсутствующий токен возвращает `401`.
`/health` остаётся доступен без токена.

За Traefik маршрутизируйте публичные запросы к signaling только по `/ws` и `/health`.
`/metrics` должен быть доступен Alloy или Prometheus по внутренней сети. Не публикуйте
порт signaling напрямую в интернет в обход Traefik.

Пример scrape-конфигурации Prometheus при запуске в одной Docker-сети:

```yaml
scrape_configs:
  - job_name: signaling
    scrape_interval: 30s
    metrics_path: /metrics
    static_configs:
      - targets: ["service:3001"]
    authorization:
      type: Bearer
      credentials_file: /run/secrets/signaling_metrics_token
```

Замените `service` на имя контейнера или сервиса signaling. Файл секрета содержит
только значение `METRICS_TOKEN`, без префикса `Bearer`. Секрет и конфигурацию сборщика
нужно предоставить отдельно. На одной машине Alloy может собирать stdout всех
контейнеров; отдельный Alloy на каждый инстанс приложения не нужен.

## Формат логов

Каждая строка — JSON-объект. Общие поля:

| Поле                                   | Значение                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `time`, `level`                        | UTC в ISO 8601 и текстовый уровень                                         |
| `service`, `environment`, `version`    | `signaling`, `NODE_ENV`, `APP_VERSION`                                     |
| `hostname`, `pid`, `instanceId`        | Машина, процесс и UUID экземпляра логгера                                  |
| `event`                                | Постоянное имя типа события, например `transfer.ended`                     |
| `eventId`                              | Новый UUID для каждой записи                                               |
| `connectionId`                         | Серверный UUID WebSocket-соединения, если применимо                        |
| `sessionId`                            | Внутренний UUID сессии, сохраняющийся при восстановлении                   |
| `requestId`                            | UUID валидированного запроса; для событий передачи — исходного предложения |
| `transferId`                           | UUID передачи из протокола                                                 |
| `senderSessionId`, `receiverSessionId` | Внутренние UUID участников передачи                                        |

`sessionId` отличается от публичного кода получения. После переподключения
`connectionId` меняется, внутренний `sessionId` сохраняется. При ротации создаётся
новая сессия; событие содержит `previousSessionId`. После перезапуска меняется
`instanceId`, а прежние сессии перестают существовать.

Имена событий:

- `server.listening`, `server.ice_unconfigured`, `server.stopping`, `server.stopped`, `server.error`;
- `connection.opened`, `connection.closed`, `connection.rejected`, `connection.terminated`, `websocket.error`;
- `session.created`, `session.resumed`, `session.rotated`, `session.expired`;
- `protocol.rejected`, `metrics.error`;
- `transfer.proposed`, `transfer.accepted`, `transfer.ended`.

`transfer.ended` содержит `reason`, `stage` (`pending` или `accepted`) и, для принятой
передачи, `durationSeconds`. `connection.closed` содержит длительность подключения
и числовой WebSocket close code в строковом поле `code`. `protocol.rejected`
содержит код ошибки и контекст текущего валидированного сообщения. Ошибки транспорта
и процесса включают объект `err` со stack trace.

В логах отсутствуют IP, публичные коды, секреты восстановления, TURN credentials,
имена отправителей и файлов, MIME, тела сообщений, SDP и ICE candidates. Некорректные
сообщения учитываются без сохранения их содержимого.

В Loki используйте стабильные labels вроде `service` и `environment`. UUID событий,
соединений, сессий, запросов и передач оставляйте полями JSON или structured metadata.

## Метрики

Все метрики имеют общий label `service="signaling"`. Метки `job` и `instance`
добавляет сборщик. UUID, IP, имена файлов и произвольные клиентские значения не
используются как labels.

| Метрика                                         | Тип и смысл                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `signaling_connections`                         | Gauge: открытые WebSocket, включая ещё не прошедшие hello                                                         |
| `signaling_sessions`                            | Gauge: сессии в памяти, включая окно восстановления                                                               |
| `signaling_transfers{stage}`                    | Gauge: ожидающие предложения и принятые передачи                                                                  |
| `signaling_connections_total`                   | Counter: принятые WebSocket-подключения                                                                           |
| `signaling_connection_rejections_total{reason}` | Counter: отклонённые upgrades; `origin_or_path`, `capacity`, `rate_limited`                                       |
| `signaling_messages_received_total{type}`       | Counter: сообщения по валидированному типу; `invalid` для некорректных, `rate_limited` для отброшенных до разбора |
| `signaling_protocol_errors_total{code}`         | Counter: ошибки протокола по серверному коду                                                                      |
| `signaling_websocket_errors_total`              | Counter: ошибки WebSocket-транспорта                                                                              |
| `signaling_transfers_proposed_total`            | Counter: созданные предложения                                                                                    |
| `signaling_transfers_accepted_total`            | Counter: принятые предложения                                                                                     |
| `signaling_transfers_ended_total{reason,stage}` | Counter: завершения по причине и стадии                                                                           |
| `signaling_transfer_duration_seconds{reason}`   | Histogram: время от принятия до завершения на signaling                                                           |
| `signaling_connection_duration_seconds`         | Histogram: время жизни закрытых соединений                                                                        |

Дополнительно доступны стандартные `process_*` и `nodejs_*`: CPU, RSS, heap, event
loop и GC. Каждый экземпляр сервера использует отдельный registry.

`complete` означает подтверждение получателя; signaling не проверяет байты файла
и не измеряет скорость WebRTC. Длительность принятой передачи включает установку
WebRTC-соединения. Отказ получателя (`rejected`) и отмена (`cancelled`) учитываются
отдельно от технического сбоя (`failed`). `expired` может относиться как к ожиданию
согласия, так и к принятой передаче — различайте их по `stage`. При перезапуске
счётчики сбрасываются; используйте `rate` или `increase`.

Примеры PromQL:

```promql
sum(signaling_connections)

sum by (reason) (rate(signaling_transfers_ended_total{stage="accepted"}[5m]))

histogram_quantile(
  0.95,
  sum by (le) (rate(signaling_transfer_duration_seconds_bucket{reason="complete"}[15m]))
)

sum by (code) (increase(signaling_protocol_errors_total[15m]))
```
