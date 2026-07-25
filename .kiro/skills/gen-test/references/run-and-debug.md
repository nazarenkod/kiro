# run-and-debug — COMPILE / RUN / DEBUG / NEG-CONTROL (кроки 4–8)

Авторитет: `DESIGN.md` кроки 4–8 + рішення **13.3** (без appium) і **13.4**
(iOS 100%). Дебаг делегується агенту `ui-test-debugger`; фікс застосовує
головний агент.

## Жорстке правило: усі mvn — через phase.sh
Голий `mvn` у кроках скіла **заборонений** — інакше device-time не міряється.

```bash
scripts/phase.sh <check_id> <phase> -- <cmd>
```

Обгортка аппендить рядок у `target/gen-test/phases-<checkId>.jsonl`
(`ts_start/ts_end/duration_s/exit_code/attempt`). Фази: `compile`, `run_aos`,
`neg_control`, `run_ios`, `retry`. Ненульові exit-коди пишуться так само —
саме вони найдорожчі.

## Крок 4 — COMPILE (без девайса)
```bash
scripts/phase.sh <checkId> compile -- mvn -s settings.xml test-compile
```
Помилки компіляції — фіксуй **inline**, петля дешева (девайс не потрібен).
Кількість ітерацій рахується → `compile_fix_iterations`.

## Крок 5 — RUN AOS (дешевша debug-платформа)
```bash
scripts/phase.sh <checkId> run_aos -- mvn -s settings.xml test -Dtest=<Клас>#<метод>
```
Платформа — з `.env` (`PLATFORM=aos`). Адресний прогін — як TestNG на методі
через surefire (не `-Dtm.ids`).

## Крок 6 — DEBUG (агент ui-test-debugger)

Парсинг page source — **самописний** (Q3): `mobile-locator-gen` +
`lib/locators/*`, офлайн, без appium-mcp.

### Три слої (без live appium на пілоті)
1. **Static dump** — єдиний дамп падіння Selenide
   (`automation.log`, `surefire-reports/`, `UIAssertionError` з
   **локатором + скріншотом + page source**, `build/reports`/`build/downloads`).
   Закриває більшість: локатор на екрані, stub, flow, data.
2. **Reveal-скан** — коли цільовий елемент **поза вьюпортом** і його немає в
   static dump. Фаза `reveal`:
   `scripts/phase.sh <checkId> reveal -- mvn ... -Dgen.test.reveal=<step>` →
   хелпер `RevealScan` дампить послідовність page source у
   `target/gen-test/reveal-<checkId>/step-NN.xml`; агент офлайн шукає локатор
   через `generate-locators.mjs --match "<expected>"`. Самописно, через штатну
   сесію тесту — **не** appium-mcp. Метрика `reveal_used`.
3. **Ескалація (tier-3)** — reveal не розрешив (віртуалізований/динамічний
   список тощо) → людині. Live appium-mcp тут — кандидат **v2**, не пілот.

Агент **сам** знаходить локатори з page source (пріоритет —
`mobile-test-standards.md`). Спершу **класифікація**, потім фікс:

| Клас | Ознаки | Стратегія |
|---|---|---|
| `locator` | елемент не знайдено; локатор не бʼється з page source | виправити селектор/компонент |
| `scroll` | елемент є в дереві, але поза вьюпортом | обгорнути скролом (авто-фікс, крок 3) |
| `stub` | запит без маппінгу / mismatch тіла | виправити стаб або `stubFor{}` |
| `data` | user/card не відповідає передумовам | змінити тест-дату у плані |
| `flow` | впав не той крок, екран інший | переглянути навігацію |
| `env` | таймаути/зʼєднання/«мигання» | ретрай без змін |
| `unknown` | не підпадає під жоден клас | **ескалація людині** (live-інспекції немає) |

### Правила петлі
- Ліміт: **3 змістовні ітерації** (фікс → перезапуск). Веде головний агент.
- `env`/flaky → **1 ретрай без змін**, він **не витрачає** ітерацію. Впав
  знову тим самим чином — це вже не flaky, класифікувати заново → `flaky_retries`.
- Агент повертає клас + діагноз + diff-подібний фікс; **застосовує головний
  агент** (safety-guard + єдиний контекст, що знає `conventions.md`).
- Вичерпано ліміт або `unknown` → ескалація людині зі зведенням діагнозів
  (`outcome=escalated`).
- Кожен перезапуск — `phase.sh <checkId> retry -- ...`.

## Крок 7 — NEG-CONTROL (обовʼязковий)
Зелений ще не означає правильний. Після першого зеленого прогону:
1. **Одна мутація** — саме в той ассерт, що мапиться на `expected` **цільового**
   кроку перевірки (або в поле стаба, від якого цей ассерт залежить). Мутація
   випадкового поля доводить менше.
2. `scripts/phase.sh <checkId> neg_control -- mvn ... -Dtest=<Клас>#<метод>` —
   тест **мусить впасти**.
3. `git checkout` мутованих файлів → повернення до зеленого без повторного
   прогону.

Впав → `negative_control: pass`. Не впав → `fail`, тест **не готовий**:
розбір ассертів з людиною обовʼязковий. На пілоті — 100% кейсів.

Межа методу: одна мутація перевіряє **живість** цільового ассерта, не
мутаційне покриття. Не ловить неправильний **контракт** стаба спочатку — тому
крок 1а вимагає дослівного копіювання тіл API.

## Крок 8 — VERIFY iOS (обовʼязково для cross-platform, рішення 13.4)
Після зеленого AOS + neg-control — обовʼязковий:
```bash
scripts/phase.sh <checkId> run_ios -- mvn -s settings.xml test -Dtest=<Клас>#<метод>
```
з `.env` `PLATFORM=ios`. Падіння iOS → та сама debug-петля (окремий бюджет:
3 ітерації; типові класи `locator`, `scroll`, платформна специфіка). Для
`platform: aos` крок пропускається. **Готовність = зелені всі платформи**
перевірки. (Вибіркова iOS — v2, розділ 12.)
