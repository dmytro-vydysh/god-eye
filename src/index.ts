

import { EventEmitter } from 'events';

/**
 * EyeOnProps - A simple and powerful watcher for JavaScript objects.
 * @module EyeOnProps
 * @version 2.0.0
 * @author Dmytro Vydysh 
 * @contact info@dmytrovydysh.com
 * @license CC0-1.0 Universal (CC0 1.0) Public Domain Dedication
 */

/**
 * Represents a watched property entry with its metadata and cached value.
 * @interface WatchedEntry
 */
export interface WatchedEntry {
  /** The object instance being watched */
  instance: any;
  /** The property name being monitored */
  prop: string;
  /** The key used to identify this property in event payloads */
  key: string;
  /** The cached last known value of the property */
  lastValue: any;
}

/**
 * Defines the monitoring mode for change detection.
 * - 'all': Emit all watched properties on every change
 * - 'changed': Emit only properties that have changed
 * - 'undefined': No monitoring active
 */
export type EyeOnPropsMode = 'all' | 'changed' | 'undefined';

/**
 * Defines the type of monitoring mechanism.
 * - 'clock': Polling-based monitoring using intervals
 * - 'real-time': Property setter interception for immediate change detection
 * - 'undefined': No monitoring type set
 */
export type EyeOnPropsType = 'clock' | 'real-time' | 'undefined';

/**
 * Defines the event emitter interface for eyeOnProps.
 * This interface extends the EventEmitter with specific event types and payloads.
 */
export interface IEyeOnPropsEventEmitter {
  'change': [Record<string, any>];
  'change:full': [Record<string, { new: any, old: any }>];
}

/**
 * EyeOnProps - A powerful object property watcher that extends EventEmitter.
 * 
 * This class provides two monitoring mechanisms:
 * 1. Clock-based (polling): Checks for changes at regular intervals
 * 2. Real-time (setter interception): Intercepts property assignments for immediate detection
 * 
 * @extends EventEmitter
 * @example
 * ```typescript
 * const EyeOnProps = new EyeOnProps();
 * const obj = { name: 'John', age: 30 };
 * const obj2 = { name: 'Dmytro', age: 26 };
 * 
 * eyeOnProps.watch(obj, 'name').clock(1000);
 * eyeOnProps.on('change', (changes) => console.log(changes));
 * ```
 */
export class EyeOnProps extends EventEmitter<IEyeOnPropsEventEmitter> {
  /** Array of watched property entries with their metadata and cached values */
  private entries: WatchedEntry[] = [];
  /** Current monitoring mode - determines what gets emitted on changes */
  private mode: EyeOnPropsMode = 'changed';
  /** Current monitoring type - determines how changes are detected */
  public type: EyeOnPropsType = 'undefined';
  /** Reference to the polling interval when using clock mode */
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Watches a single property of an object instance.
   * @param instance - The object instance to watch
   * @param prop - The property name to monitor
   * @param key - Optional custom key for event payloads (defaults to prop name)
   * @returns this - Returns the current instance for method chaining
   */
  public watch(
    instance: any,
    prop: string,
    key?: string
  ): this;

  /**
   * Watches multiple properties of an object instance.
   * @param instance - The object instance to watch
   * @param props - Array of property configurations: [propName] or [propName, customKey]
   * @returns this - Returns the current instance for method chaining
   */
  public watch(
    instance: any,
    props: ([string] | [string, string])[]
  ): this;

  /**
   * Main watch method implementation that handles both single and multiple property watching.
   * This method uses method overloading to provide different signatures for different use cases.
   * 
   * @param instance - The object instance to watch
   * @param arg2 - Either a single property name (string) or an array of property configurations
   * @param key - Optional custom key for single property watching
   * @returns this - Returns the current instance for method chaining
   * @throws Error when invalid arguments are provided
   * 
   * @example
   * ```typescript
   * // Watch single property
   * eyeOnProps.watch(obj, 'name');
   * 
   * // Watch single property with custom key
   * eyeOnProps.watch(obj, 'name', 'userName');
   * 
   * // Watch multiple properties
   * eyeOnProps.watch(obj, [['name'], ['age', 'userAge']]);
   * ```
   */
  public watch(
    instance: any,
    property_or_properties: string | ([string] | [string, string])[],
    key?: string
  ): this {
    // Handle single property watching
    if (typeof property_or_properties === 'string') {
      const prop = property_or_properties;
      const resolvedKey = key ?? prop;
      this.addEntry({
        instance,
        prop,
        key: resolvedKey,
        lastValue: instance[prop],
      });
      return this;
    }

    // Handle multiple properties watching
    if (Array.isArray(property_or_properties)) {
      for (const entry of property_or_properties) {
        const [prop, customKey] = entry;
        this.addEntry({
          instance,
          prop,
          key: customKey ?? prop,
          lastValue: instance[prop],
        });
      }
      return this;
    }

    throw new Error('Invalid arguments passed to watch()');
  }

  /**
   * Adds a new watched property entry to the internal tracking array.
   * Creates a fresh snapshot of the current property value for change detection.
   * 
   * @param entry - The watched entry containing instance, property, and key information
   * @private
   */
  private addEntry(entry: WatchedEntry): void {
    if (!(entry.prop in entry.instance))
      throw new Error(`Property "${entry.prop}" does not exist on the provided instance.`);
    this.entries.push({ ...entry, lastValue: entry.instance[entry.prop] });
  }

  /**
   * Enables clock-based monitoring using polling intervals.
   * Sets up periodic checks for property changes at specified intervals.
   * This method is non-intrusive and doesn't modify the original object properties.
   * 
   * @param ms - Interval in milliseconds for polling changes
   * @returns this - Returns the current instance for method chaining
   * @throws Error if called after realTime() has been invoked
   * 
   * @example
   * ```typescript
   * eyeOnProps.watch(obj, 'name').clock(1000); // Check every 1 second
   * ```
   */
  public clock(ms: number): this {
    // Prevent switching from real-time to clock mode due to irreversible property modifications
    if (this.type === 'real-time') {
      throw new Error("Cannot use clock() after realTime(): realTime() has already modified monitored properties with intrusive setters. The instance cannot be restored to its original behavior.");
    }

    this.type = 'clock';
    this.clear(); // Clear any existing intervals
    this.intervalId = setInterval(() => this.check(), ms);
    return this;
  }

  /**
   * Enables real-time monitoring by intercepting property setters.
   * This method modifies the original object properties by replacing them with custom getters and setters.
   * Changes are detected immediately when properties are assigned new values.
   * 
   * WARNING: This method is intrusive and irreversible. Once applied, the original property behavior
   * cannot be restored on the same instance.
   * 
   * @returns this - Returns the current instance for method chaining
   * @emits IntrusiveOverrideWarning - Process warning about irreversible property modifications
   * 
   * @example
   * ```typescript
   * eyeOnProps.watch(obj, 'name').realTime();
   * obj.name = 'Jane'; // Change detected immediately
   * ```
   */
  public realTime(): this {
    this.type = 'real-time';

    // Emit a process warning to inform about the intrusive nature of this method
    process.emitWarning('Monitored properties have been overridden with custom setters. It is no longer possible to restore the instance\'s original behavior.', {
      code: 'GOD_EYE_REALTIME_SETTER_OVERRIDE',
      type: 'IntrusiveOverrideWarning',
      detail: 'Each observed property has been redefined with a setter that intercepts the changes. This behavior is irreversible on the same instance.'
    });

    this.clear(); // Clear any existing intervals

    // Override each watched property with custom getter/setter
    this.entries.forEach(e => {
      let value = e.instance[e.prop]; // Store current value in closure

      Object.defineProperty(e.instance, e.prop, {
        get: () => value,
        set: (v: any) => {
          // Only trigger change detection if the value actually changed
          if (v !== value) {
            value = v;

            // Emit change event based on current mode
            if (this.mode !== 'undefined') {
              const fullPayload = this.mode === 'all'
                ? this.buildFullAllPayload()
                : (v !== e.lastValue ? { [e.key]: { new: v, old: e.lastValue } } : {});

              const payload = this.mode === 'all'
                ? this.buildAllPayload()
                : { [e.key]: v };

              if (Object.keys(payload).length > 0)
                this.emit('change', payload);

              if (Object.keys(fullPayload).length > 0)
                this.emit('change:full', fullPayload);
            }

            e.lastValue = v;
          }
        },
        configurable: true,
        enumerable: true,
      });
    });
    return this;
  }

  /**
   * Sets the monitoring mode to 'all' - emit all watched properties on every change.
   * In this mode, every change event will include all currently watched properties and their values,
   * regardless of which specific property triggered the change.
   * 
   * @returns this - Returns the current instance for method chaining
   * 
   * @example
   * ```typescript
   * eyeOnProps.watch(obj, ['name', 'age']).all().clock(1000);
   * // When 'name' changes, the event will include both 'name' and 'age' values
   * ```
   */
  public all(): this {
    this.mode = 'all';
    return this;
  }

  /**
   * Sets the monitoring mode to 'changed' - emit only properties that have changed.
   * In this mode, change events will only include the properties that actually changed
   * their values since the last check. This is the default behavior.
   * 
   * @returns this - Returns the current instance for method chaining
   * 
   * @example
   * ```typescript
   * eyeOnProps.watch(obj, ['name', 'age']).changedOnly().clock(1000);
   * // When 'name' changes, the event will only include 'name' and its new value
   * ```
   */
  public changedOnly(): this {
    this.mode = 'changed';
    return this;
  }

  /**
   * Internal method for checking property changes during clock-based monitoring.
   * Iterates through all watched entries, compares current values with cached values,
   * and emits change events based on the current monitoring mode.
   * 
   * This method is called periodically by the interval timer when clock() mode is active.
   * It handles both 'all' and 'changed' modes appropriately.
   * 
   * @private
   */
  private check(): void {
    const updates: Record<string, any> = {};

    // Iterate through all watched entries
    for (const e of this.entries) {
      const current = e.instance[e.prop];
      const changed = current !== e.lastValue;

      // Include property in updates based on mode
      if (this.mode === 'all' || changed) {
        updates[e.key] = current;
      }

      // Update cached value if changed
      if (changed) e.lastValue = current;
    }

    // Emit change event if there are updates to report
    if (Object.keys(updates).length > 0) {
      this.emit('change', updates);
    }
  }

  /**
   * Builds a payload containing all currently watched properties and their values.
   * This method is used in 'all' mode to include all properties in change events,
   * regardless of which specific property triggered the change.
   * 
   * @returns Record<string, any> - Object containing all watched properties as key-value pairs
   * @private
   */
  private buildAllPayload(): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const e of this.entries) {
      payload[e.key] = e.instance[e.prop];
    }
    return payload;
  }

  /**
   * Builds a full payload for 'all' mode change events.
   * This method includes both the new values and the old values for each watched property.
   * It is used to provide a comprehensive snapshot of the state of all watched properties.
   * @param {Record<string, any>} - Object containing all watched properties with their new and old values
   * @returns Record<string, any> - Object containing all watched properties with their new and old values
   * @throws Error if called in a mode other than 'all' 
   * @private
   */
  private buildFullAllPayload(): Record<string, any> {
    if (this.mode !== 'all')
      throw new Error("buildFullAllPayload() can only be called in 'all' mode.");

    const payload: Record<string, any> = {};
    for (const e of this.entries) {
      payload[e.key] = {
        new: e.instance[e.prop],
        old: e.lastValue,
      };
    }
    return payload;
  }

  /**
   * Clears any active polling intervals and resets the interval reference.
   * This method is called when switching monitoring modes or stopping monitoring.
   * It ensures that no background polling continues when not needed.
   * 
   * @private
   */
  private clear(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
