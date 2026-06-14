# screen-analyzer checks

All checks run over the page-source XML (via the lifted locator pipeline). Each
finding has a `severity` (high | medium | low | info), a `rule`, a `message`, the
offending `element`, its `locators`, and a `suggestion`.

| rule | severity | what it flags |
|------|----------|---------------|
| `missing-accessible-name` | high | interactive control with no content-desc/label (Android) or name/label (iOS) |
| `image-missing-description` | medium | image element with no text alternative |
| `small-touch-target` | medium | tappable element smaller than `--min-touch` px (default 40) |
| `disabled-interactive` | info | interactive element with `enabled=false` |
| `hidden-interactive` | info | interactive element not visible (`displayed=false` / `visible=false`) |
| `duplicate-id` | medium | `resource-id` shared by more than one element |
| `duplicate-accessible-name` | low | accessible name shared by multiple interactive elements |
| `brittle-locator` | medium | only xpath / class-name locators available (no stable id) |

Bounds are read from Android `bounds="[x1,y1][x2,y2]"` or iOS `x/y/width/height`.
Platform is auto-detected from the XML; override with `--automation`.
