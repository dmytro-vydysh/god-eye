# EyeOnProps

**EyeOnProps** is a lightweight and powerful JavaScript/TypeScript utility for monitoring property changes on any number of object instances. It supports both polling-based and real-time observation, and emits events when watched properties change.

* ⚡️ Supports multiple objects per watcher
* 🕒 Choose between polling (`clock`) and setter override (`realTime`) modes
* 🧠 Utilizes `WeakRef` and `FinalizationRegistry` to avoid memory leaks
* 📢 Emits two event types: simple (`change`) and detailed (`change:full`)

---

## Installation

```bash
npm install eye-on-props
```

---

## Usage

### Basic Setup

```ts
import { EyeOnProps } from 'eye-on-props';

const obj = { value: 1 };
const watcher = new EyeOnProps();

watcher.watch(obj, 'value');

watcher.on('change', (data) => {
  console.log('Changed:', data);
});

watcher.clock(1000); // Poll every second
```

---

## API

### `watch(instance, prop: string, key?: string)`

Watch a single property. Optionally specify a custom key name.

### `watch(instance, props: ([string] | [string, string])[])`

Watch multiple properties at once. Each item is either:

* `["prop"]` → uses same key as prop
* `["prop", "customKey"]`

### `clock(ms: number)`

Start polling mode. Checks for changes at the given interval (in ms).

> ❗ Cannot be used after `.realTime()`

### `realTime()`

Switch to real-time mode. Overrides the property setters to trigger updates immediately.

> ⚠️ This is **intrusive** and **irreversible** per instance. Once a setter is modified, its original behavior **cannot** be restored.

### `all()`

Emit **all** watched properties on every change (even if values didn't change).

### `changedOnly()` *(default)*

Emit only properties whose values have actually changed.

### `unwatch(instance)`

Stop watching all properties of the given instance.

---

## Events

### `change`

```ts
watcher.on('change', (payload: Record<string, any>) => { ... });
```

Simple payload containing the latest values.

### `change:full`

```ts
watcher.on('change:full', (payload: Record<string, { new: any, old: any }>) => { ... });
```

Detailed payload containing both previous and current values.

---

## Notes

* You can use **a single EyeOnProps instance** to monitor **multiple object instances** simultaneously.
* `WeakRef` is used to avoid holding strong references. Objects can be garbage collected naturally.
* `FinalizationRegistry` automatically cleans up entries when objects are collected.

---

## Example with Multiple Objects

```ts
const user = { name: 'Alice' };
const task = { status: 'open' };

const watcher = new EyeOnProps()
  .watch(user, [['name', 'username']])
  .watch(task, [['status']])
  .realTime()
  .all();

watcher.on('change', console.log);
```

---

## License

**Public Domain** (CC0-1.0) – do whatever the hell you want.

---

## Author

**Dmytro Vydysh**
Email: [info@dmytrovydysh.com](mailto:info@dmytrovydysh.com)

---
