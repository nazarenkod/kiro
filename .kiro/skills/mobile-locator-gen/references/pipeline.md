# Locator generation pipeline

The engine reuses the locator code lifted from appium-mcp (`lib/locators/`):

1. **source-parsing** (`xmlToJSON`) — parse the page-source XML into a JSON tree of
   elements (tagName, attributes, dot-separated path).
2. **element-filter** (`shouldIncludeElement`) — drop the `hierarchy` root and, when
   `--interactive` is set, keep only interactable elements (buttons, fields, clickable).
3. **locator-generation** (`getSuggestedLocators`) — for each element produce locators
   for every applicable strategy and sort them by platform priority:
   - iOS: `id` > `accessibility id` > `-ios predicate string` > `-ios class chain` > `xpath` > `class name`
   - Android: `id` > `accessibility id` > `xpath` > `-android uiautomator` > `class name`
   "Simple" strategies (accessibility id / id / class name) are only emitted when the
   attribute value is unique in the document; xpath/predicate/class-chain are computed
   to be as unique and short as possible.
4. **generate-all-locators** (`generateAllElementLocators`) — traverse the tree and
   collect `{ tagName, locators, text, contentDesc, resourceId, clickable, enabled,
   displayed, path, attributes }` per element.

The CLI then flattens that into candidates and exposes `best` (the top-priority
locator). Matching the candidate to the user's described element and writing it into
a Page Object is done by the agent, not the script.

Platform is auto-detected from the XML (`XCUIElementType*` => xcuitest, otherwise
uiautomator2); override with `--automation`.
