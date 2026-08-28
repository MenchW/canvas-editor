# Control Options

The control's properties in document data (`IElement.control`), organized by control type.

## Common Properties (all types)

| Property        | Type                                                                          | Description                                                        |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `type`          | `'text' \| 'select' \| 'checkbox' \| 'radio' \| 'date' \| 'number' \| 'image'` | Control type                                                       |
| `listType`      | `'text' \| 'checkbox' \| 'radio' \| 'image'`                                  | List control type (segmented text/option groups/multi-image)       |
| `value`         | `IElement[] \| null`                                                          | Control value                                                      |
| `placeholder`   | `string`                                                                      | Placeholder                                                        |
| `conceptId`     | `string`                                                                      | Concept id (shared by multiple controls; used by cascade/getValue) |
| `groupId`       | `string`                                                                      | Group id                                                           |
| `prefix`        | `string`                                                                      | Prefix character                                                   |
| `postfix`       | `string`                                                                      | Postfix character                                                  |
| `preText`       | `string`                                                                      | Pre text                                                           |
| `postText`      | `string`                                                                      | Post text                                                          |
| `minWidth`      | `number`                                                                      | Minimum width                                                      |
| `underline`     | `boolean`                                                                     | Underline                                                          |
| `border`        | `boolean`                                                                     | Border                                                             |
| `extension`     | `unknown`                                                                     | Extension data                                                     |
| `indentation`   | `ControlIndentation`                                                          | Indentation                                                        |
| `rowFlex`       | `RowFlex`                                                                     | Row alignment                                                      |
| `deletable`     | `boolean`                                                                     | Deletable. Default: true                                           |
| `disabled`      | `boolean`                                                                     | Disabled (not editable)                                            |
| `pasteDisabled` | `boolean`                                                                     | Paste disabled                                                     |
| `hide`          | `boolean`                                                                     | Hidden                                                             |
| `when`          | `string`                                                                      | Conditional rendering expression (like `v-if`, auto-hidden when false) |
| `required`      | `boolean`                                                                     | Required (used in validation, can be toggled by cascades)          |
| `cascade`       | `IControlCascadeRule[]`                                                       | Cascade rules, see: Control-Cascade                                |
| `validation`    | `IControlValidation`                                                          | Validation rules, see: Control-Validation                          |
| `compute`       | `string`                                                            | Compute expression, see: Control-Cascade                           |
| `font`          | `string`                                                            | Value font                                                         |
| `size`          | `number`                                                            | Value size                                                         |
| `bold`          | `boolean`                                                           | Value bold                                                         |
| `color`         | `string`                                                            | Value color                                                        |
| `highlight`     | `string`                                                            | Value highlight                                                    |
| `italic`        | `boolean`                                                           | Value italic                                                       |
| `strikeout`     | `boolean`                                                           | Value strikeout                                                    |

## TEXT Control

Common properties only. When `listType: 'text'`, incoming array data will be automatically expanded and formatted as multi-line paragraph items.

## SELECT Control

Common properties, plus:

| Property                 | Type                                | Description            |
| ------------------------ | ----------------------------------- | ---------------------- |
| `code`                   | `string \| null`                    | Selected code          |
| `valueSets`              | `{ value: string; code: string }[]` | Candidate values       |
| `isMultiSelect`          | `boolean`                           | Multi-select           |
| `multiSelectDelimiter`   | `string`                            | Multi-select delimiter |
| `selectExclusiveOptions` | `{ inputAble?: boolean }`           | Allow input            |

## CHECKBOX Control

Common properties, plus:

| Property        | Type                                | Description                      |
| --------------- | ----------------------------------- | -------------------------------- |
| `code`          | `string \| null`                    | Selected codes (comma-separated) |
| `valueSets`     | `{ value: string; code: string }[]` | Candidate values                 |
| `min`           | `number`                            | Minimum selections               |
| `max`           | `number`                            | Maximum selections               |
| `flexDirection` | `FlexDirection`                     | Layout direction                 |

## RADIO Control

Common properties, plus:

| Property        | Type                                | Description      |
| --------------- | ----------------------------------- | ---------------- |
| `code`          | `string \| null`                    | Selected code    |
| `valueSets`     | `{ value: string; code: string }[]` | Candidate values |
| `flexDirection` | `FlexDirection`                     | Layout direction |

## DATE Control

Common properties, plus:

| Property     | Type     | Description                               |
| ------------ | -------- | ----------------------------------------- |
| `dateFormat` | `string` | Date format. Default: yyyy-MM-dd hh:mm:ss |

## NUMBER Control

Common properties, plus:

| Property                 | Type                               | Description        |
| ------------------------ | ---------------------------------- | ------------------ |
| `numberExclusiveOptions` | `{ calculatorDisabled?: boolean }` | Disable calculator |

## IMAGE Control

Common properties, plus (supports single image and multi-image grid layout):

| Property   | Type                                          | Description                                                        |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `width`    | `number`                                      | Render width (px). Default: 100                                    |
| `height`   | `number`                                      | Render height (px). Default: 80                                   |
| `layout`   | `'horizontal' \| 'vertical' \| 'grid'`        | Multi-image layout mode (horizontal, vertical, or multi-column grid)|
| `gridCols` | `number`                                      | Grid columns (effective when `layout: 'grid'`)                     |
