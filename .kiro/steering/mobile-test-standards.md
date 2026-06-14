---
inclusion: fileMatch
fileMatchPattern: "**/{test,tests,e2e,specs,pageobjects,locators}/**"
---

# Mobile test & Page Object standards

Conventions for mobile UI tests and Page Objects built with the Appium skills in
this repo. Applies when working in test / page-object / locator files.

## Locator strategy priority
Prefer the most stable, least brittle locator. In order:

1. **accessibility id** (Android `content-desc`, iOS `name`/accessibilityIdentifier)
2. **id** (Android `resource-id`, web/native `id`)
3. Platform-native query: **-ios predicate string** / **-ios class chain** (iOS),
   **-android uiautomator** (Android)
4. **xpath** — last resort, and only an attribute-qualified xpath, never a deep
   positional path
5. **class name** — only to disambiguate, never alone

The `mobile-locator-gen` engine already orders locators this way; take its `best`
candidate unless there is a reason not to. Never hard-code volatile values (indices,
coordinates) when a stable attribute exists.

## Page Object structure
- One Page Object per screen; expose actions (methods), not raw locators, to tests.
- Field/element names describe intent (`loginButton`, `emailField`), not the widget
  type or locator.
- Keep selectors at the top of the class / in one place; no inline selectors in tests.
- Match the project's existing framework and language (Selenide, Appium PageFactory
  `@AndroidFindBy`/`@iOSXCUITFindBy`, WebDriver `By`, etc.). Do not introduce a new
  style — follow what the file already uses.

## Waits & stability
- Use explicit/condition-based waits; never `sleep`/`Thread.sleep`.
- Assert on a stable element being present/visible before interacting.
- Treat a flaky locator as a bug — prefer fixing the locator (or asking the app team
  for a stable id) over adding retries.

## Artifacts
- Save screenshots and page-source dumps on failure (so `screen-analyzer` can be run
  against them). Keep them out of version control.
