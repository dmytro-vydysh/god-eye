# EyeOnProps

**Version:** 2.0.0
**Author:** Dmytro Vydysh
**License:** CC0-1.0 Universal (Public Domain)

---

## Overview

**EyeOnProps** is a lightweight but powerful JavaScript/TypeScript library for monitoring object properties.
It can detect changes either via polling (interval-based) or by intercepting property setters in real time.

Built on top of Node.js `EventEmitter`, it supports flexible watch setups, change detection modes, and clean event emissions.

---

## Features

* 🔍 Watch one or more properties on any object
* 🕒 Polling mode (`clock`) to check for changes on intervals
* ⚡ Real-time mode (`realTime`) to intercept property changes immediately
* 🔄 Modes for emitting all values or only changed ones
* 🧠 Typed and well-documented API
* 🚫 Real-time overrides are irreversible (by design)

---

## Installation

```bash
npm install eye-on-props
```

---

## Usage

```ts
import { EyeOnProps } from 'eye-on-props';

const obj = { name: 'John', age: 30 };
const eyeOnProps = new EyeOnProps();

// Watch a single property and use clock mode
eyeOnProps.watch(obj, 'name').clock(1000);

// Event listener
eyeOnProps.on('change', changes => console.log(changes));
```

---

## API Reference

### Class: `EyeOnProps`

#### Method: `.watch(instance, prop, key?)`

Watch a single property:

```ts
eyeOnProps.watch(obj, 'name');
eyeOnProps.watch(obj, 'name', 'username');
```

#### Method: `.watch(instance, [[prop, key?], ...])`

Watch multiple properties:

```ts
eyeOnProps.watch(obj, [['name'], ['age', 'userAge']]);
```

---

### Method: `.clock(ms)`

Enable polling-based monitoring:

```ts
eyeOnProps.watch(obj, 'name').clock(1000); // check every 1 second
```

* ❌ Throws if `.realTime()` was called before

---

### Method: `.realTime()`

Enable real-time interception:

```ts
eyeOnProps.watch(obj, 'name').realTime();
obj.name = 'Jane'; // triggers immediately
```

* ⚠️ Intrusive — overrides property behavior permanently
* Emits a Node.js warning (`process.emitWarning`)

---

### Method: `.all()`

Emit all values on every change:

```ts
eyeOnProps.all();
```

Useful for syncing full UI states or logs.

---

### Method: `.changedOnly()` (default)

Emit only properties that changed:

```ts
eyeOnProps.changedOnly();
```

Optimized for minimal traffic/logging.

---

## Events

### Event: `'change'`

Fired when a change is detected.

```ts
eyeOnProps.on('change', (payload) => {
  console.log(payload);
});
```

---

## Examples

### Watch single property, real-time

```ts
const user = { name: 'Alice' };
eyeOnProps.watch(user, 'name').realTime();
user.name = 'Bob';
```

### Watch multiple properties, polling

```ts
const user = { name: 'John', age: 25 };
EyeOnProps
  .watch(user, [['name'], ['age']])
  .all()
  .clock(500);
```

### Watch property with custom key

```ts
const product = { price: 100 };
eyeOnProps.watch(product, 'price', 'priceEUR').clock(2000);
```

---

## Notes

* 🧼 Calling `.realTime()` permanently changes property behavior with `Object.defineProperty`
* 🔁 `.clock()` uses a `setInterval` which must be cleared (automatically handled internally)
* ⚠️ Do **not** mix `.clock()` and `.realTime()` on the same instance

---

## License

This project is licensed under **CC0 1.0 Universal (Public Domain Dedication)**.
You are free to use, modify, distribute, and incorporate it however you like.

---

## Contact

**Dmytro Vydysh**
📧 [info@dmytrovydysh.com](mailto:info@dmytrovydysh.com)
