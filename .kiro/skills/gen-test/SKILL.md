---
name: gen-test
description: Перетворює перевірку крит-функціоналу з TestManager на компільований зелений Kotlin UI-тест у privat24-ui-tests. Use when потрібно згенерувати UI-автотест за functionalId або checkId, або зібрати MR (/gen-test mr) для згенерованих тестів. Оркеструє агенти tm-case-fetcher, repo-scout, ui-test-debugger, mr-composer.
keywords: gen-test, functionalId, checkId, TestManager, TMId, UI-тест, автотест, negative control, MR, merge request, крит-функціонал
---

# gen-test

Головний агент-оркестратор. Перетворює перевірку з TestManager (ТМ) на робочий
Kotlin UI-тест у `privat24-ui-tests`: компільований, зелений на Android (і iOS
для cross-platform), відповідає `conventions.md`, лежить у
`src/test/kotlin/tests/<feature>/`.

**Виконання — через Kiro CLI, не IDE** (рішення 13.1, чек #6637 — розділ 0
`DESIGN.md`). Повний дизайн — `DESIGN.md`; закриті рішення — `DECISIONS.md`.

## Тригери / команди
- `/gen-test <functionalId>` — весь блок (батч перевірок).
- `/gen-test check:<checkId>` — одна перевірка.
- `/gen-test mr` — окремо зібрати MR для готового набору (агент `mr-composer`).

## Ключові принципи (незмінні)
1. Вхід — конкретний блок (`functionalId`) або одна перевірка (`checkId`).
2. Витяг опису — агент `tm-case-fetcher` на дешевій моделі; тіла API — **дослівно**.
3. Дебаг дешевий, парсинг page source — **самописний** (`mobile-locator-gen` +
   `lib/locators/*`, офлайн, без appium-mcp): static dump падіння Selenide →
   **reveal-скан** для off-screen локатора → ескалація. Live appium-mcp — v2
   last-resort (рішення 13.3, ревізія).
4. **Зелений ≠ правильний** — обовʼязковий негативний контроль (крок 7).
5. `gaps` — не блокер і не привід вигадувати: закриває людина на чекпоінті.
6. Кожен прогін лишає рядок метрик автоматично (розділ 6 `DESIGN.md`).
7. Навчання — наявний `reflection` + журнал сесії; уроки → `references/lessons.md`.
8. **ТМ — source of truth** (рішення 13.2): при дрейфі тест регенерується, тож
   план тримаємо regen-friendly (стабільні рішення, порядок, імена).

## Пайплайн

Детальні правила кожного кроку — у `references/` (посилання нижче).

```
1. FETCH ∥ SCOUT   паралельно делегувати: tm-case-fetcher (TM → спек + gaps[])
                   і repo-scout (репо → мапа + template + скрол-факти).
                   Кеш скаута на блок: target/gen-test/scout-<functionalId>.yaml
2. PLAN            джойн спека і мапи → user/card/deeplink/stubs/feature-тека.
                   Обʼєднані gaps → питання людині.  → ЧЕКПОІНТ (risk-based)
                   → references/planning.md
3. CODEGEN         тест за conventions.md, еталон = template від скаута;
                   traceability-карта (step/expected → ассерт); скрол — за
                   евристикою (scroll-always default, 13.6); брак екрана/
                   компонента = ФЛАГ, не вигадка → references/codegen.md
4. COMPILE         phase.sh compile → mvn test-compile → фікс inline (без девайса)
5. RUN AOS         phase.sh run_aos → mvn test -Dtest=<Клас>#<метод>
6. DEBUG           делегувати ui-test-debugger: класифікація → точковий фікс →
                   повтор (bounded: 3 змістовні; flaky поза лімітом). Слої:
                   static dump → reveal-скан (off-screen локатор, фаза reveal) →
                   ескалація. Фікс застосовує головний агент.
                   → references/run-and-debug.md
7. NEG-CONTROL     зламати ЦІЛЬОВИЙ ассерт/стаб → прогін МУСИТЬ впасти → git revert
8. VERIFY iOS      обовʼязково після зеленого AOS для cross-platform (13.4)
9. REPORT          підсумок + шлях + TMId + рядок метрик (log_run.py);
                   журнал → reflection
──────────────────────────────────────────────────────────────────────────
10. MR             окремою командою /gen-test mr: агент mr-composer
                   → references/mr.md
```

## Оркестрація агентів
- **FETCH+SCOUT паралельно** — делегувати обидва сабагенти в одному такті (CLI
  тримає до 4 паралельно). Скаут стартує без спека (grep за `@TMId`).
- **DEBUG** — делегувати `ui-test-debugger`; він повертає діагноз+фікс, **фікс
  застосовує головний агент** (safety-guard + єдиний контекст, що знає
  `conventions.md`).
- **MR** — делегувати `mr-composer` лише за командою `/gen-test mr`.
- Головний агент лишає собі: PLAN, CODEGEN, негативний контроль, застосування
  фіксів, запис метрик — кроки, де потрібен повний контекст рішень.

## Правила середовища (жорсткі)
- **Усі `mvn` — лише через `scripts/phase.sh`** (інакше device-time не
  міряється). Голий `mvn` у кроках скіла заборонений. → `references/run-and-debug.md`
- Платформа/режим — через `.env` (`PLATFORM=ios|aos`, `RUN_MODE`, `ENABLE_HUB`).
- Адресний прогін — як TestNG на методі через surefire:
  `-Dtest=<Клас>#<метод>` (не `-Dtm.ids`).
- Робочі артефакти — у `target/gen-test/` (не в git); метрики —
  `metrics/*.jsonl` (git-tracked).

## Чекпоінт (risk-based)
- **Авто-прохід** лише якщо `gaps` порожній **і** всі ресурси зарезолвлені
  (feature-тека, user, card, усі стаби існують, екрани є).
- Інакше — **пауза на людину**: план (`target/gen-test/plan-<checkId>.md`) +
  список питань з `gaps`. Момент паузи і відповіді маркуються в метриках
  (`human_seconds`). Агент **не заповнює прогалини здогадками**.

## Референси
- `references/planning.md` — case → feature/user/card/stub/deeplink, чекпоінт, gaps.
- `references/codegen.md` — чек-ліст кодогену, евристика скролу, колізія стабів.
- `references/run-and-debug.md` — phase.sh, артефакти, класи падінь, петля, neg-control.
- `references/mr.md` — процедура MR: шаблон, маркери, гейт, гранулярність.
- `references/lessons.md` — уроки gen-test від reflection (стартово порожній).
- `references/mr-template.gen-test.md` — заготовка MR-шаблону (людина ставить у `.gitlab/`).

## Джерела правди (не переписувати автоматично)
- `.kiro/steering/conventions.md` — DSL, PbComponents, правила коду (target-репо).
- `.kiro/steering/{product,structure,tech}.md`, `tests/base/BaseTest.kt`.
- `.gitlab/merge_request_templates/*.md`, TestManager MCP.

## Скрипти
- `scripts/phase.sh` — обгортка прогонів → `phases-<checkId>.jsonl`.
- `scripts/strip_html.py` — детермінований HTML-стрип (для fetcher).
- `scripts/log_run.py` — валідація схеми + злиття фаз + апенд у `runs.jsonl`.
- `scripts/mr_stats.py` — added/changed тести і TMId з `git diff`.
- `scripts/metrics_summary.py` — агрегати по `runs.jsonl` + `mrs.jsonl`.

## Навчання
Під час роботи — дописувати рішення/тупики в журнал
`.kiro/reflections/journals/`; наприкінці — `reflection`. Уроки, специфічні
для генерації, → `references/lessons.md`. **`conventions.md` недоторканний**:
дрейф закриває reflection → `lessons.md`, не автоправка довідника.
