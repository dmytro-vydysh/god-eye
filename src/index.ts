import { EventEmitter } from 'events';

/**
 * EyeOnProps - A simple and powerful watcher for JavaScript objects.
 * @module EyeOnProps
 * @version 2.1.0
 * @license CC0-1.0 Universal (CC0 1.0) Public Domain Dedication
 */

export interface WatchedEntry {
  /** Weak reference to the object instance being watched */
  instanceRef: WeakRef<any>;
  /** The property name being monitored */
  prop: string;
  /** The key used to identify this property in event payloads */
  key: string;
  /** The cached last known value of the property */
  lastValue: any;
}

export type EyeOnPropsMode = 'all' | 'changed' | 'undefined';
export type EyeOnPropsType = 'clock' | 'real-time' | 'undefined';

export interface IEyeOnPropsEventEmitter {
  'change': [Record<string, any>];
  'change:full': [Record<string, { new: any, old: any }>];
}

export class EyeOnProps extends EventEmitter<IEyeOnPropsEventEmitter> {
  private entries: WatchedEntry[] = [];
  private mode: EyeOnPropsMode = 'changed';
  public type: EyeOnPropsType = 'undefined';
  private intervalId: NodeJS.Timeout | null = null;
  private registry = new FinalizationRegistry<string>((key) => {
    // Cleanup entry when the object is garbage collected
    this.entries = this.entries.filter(e => e.key !== key);
  });

  public watch(instance: any, prop: string, key?: string): this;
  public watch(instance: any, props: ([string] | [string, string])[]): this;
  public watch(
    instance: any,
    property_or_properties: string | ([string] | [string, string])[],
    key?: string
  ): this {
    if (typeof property_or_properties === 'string') {
      const prop = property_or_properties;
      const resolvedKey = key ?? prop;
      this.addEntry(instance, prop, resolvedKey);
      return this;
    }

    if (Array.isArray(property_or_properties)) {
      for (const [prop, customKey] of property_or_properties) {
        this.addEntry(instance, prop, customKey ?? prop);
      }
      return this;
    }

    throw new Error('Invalid arguments passed to watch()');
  }

  private addEntry(instance: any, prop: string, key: string): void {
    if (!(prop in instance))
      throw new Error(`Property "${prop}" does not exist on the provided instance.`);
    this.entries.push({
      instanceRef: new WeakRef(instance),
      prop,
      key,
      lastValue: instance[prop],
    });
    this.registry.register(instance, key);
  }

  public clock(ms: number): this {
    if (this.type === 'real-time') {
      throw new Error("Cannot use clock() after realTime(): realTime() has already modified monitored properties with intrusive setters. The instance cannot be restored to its original behavior.");
    }
    this.type = 'clock';
    this.clear();
    this.intervalId = setInterval(() => this.check(), ms);
    return this;
  }

  public realTime(): this {
    this.type = 'real-time';
    process.emitWarning('Monitored properties have been overridden with custom setters. It is no longer possible to restore the instance\'s original behavior.', {
      code: 'GOD_EYE_REALTIME_SETTER_OVERRIDE',
      type: 'IntrusiveOverrideWarning',
      detail: 'Each observed property has been redefined with a setter that intercepts the changes. This behavior is irreversible on the same instance.'
    });
    this.clear();

    this.entries.forEach(e => {
      const instance = e.instanceRef.deref();
      if (!instance) return;

      let value = instance[e.prop];

      Object.defineProperty(instance, e.prop, {
        get: () => value,
        set: (v: any) => {
          if (v !== value) {
            value = v;
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

  public all(): this {
    this.mode = 'all';
    return this;
  }

  public changedOnly(): this {
    this.mode = 'changed';
    return this;
  }

  private check(): void {
    const updates: Record<string, any> = {};
    this.entries = this.entries.filter(e => {
      const instance = e.instanceRef.deref();
      if (!instance) return false;

      const current = instance[e.prop];
      const changed = current !== e.lastValue;

      if (this.mode === 'all' || changed) {
        updates[e.key] = current;
      }
      if (changed) e.lastValue = current;
      return true;
    });

    if (Object.keys(updates).length > 0) {
      this.emit('change', updates);
    }
  }

  private buildAllPayload(): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const e of this.entries) {
      const instance = e.instanceRef.deref();
      if (instance) payload[e.key] = instance[e.prop];
    }
    return payload;
  }

  private buildFullAllPayload(): Record<string, { new: any, old: any }> {
    if (this.mode !== 'all')
      throw new Error("buildFullAllPayload() can only be called in 'all' mode.");

    const payload: Record<string, { new: any, old: any }> = {};
    for (const e of this.entries) {
      const instance = e.instanceRef.deref();
      if (instance) {
        payload[e.key] = {
          new: instance[e.prop],
          old: e.lastValue,
        };
      }
    }
    return payload;
  }

  private clear(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Manually stop watching a specific instance.
   * This can be used to avoid leaks if you no longer need to track an object.
   * @param instance The object instance to unwatch
   * @returns this
   */
  public unwatch(instance: any): this {
    this.entries = this.entries.filter(e => {
      const inst = e.instanceRef.deref();
      return inst && inst !== instance;
    });
    return this;
  }
}
