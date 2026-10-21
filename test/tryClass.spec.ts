import { tryClass, tryWrap, TryCatch, Try, Catch, CatchError } from '../src';

class Client {
  readonly #key = 'key';

  constructor(readonly host: string) {}

  get url(): string {
    if (!this.host) {
      throw new Error('no host configured');
    }

    return `https://${this.host}`;
  }

  connect(): string {
    throw new Error('refused');
  }

  send(): string {
    return this.#key;
  }
}

describe('tryClass', () => {
  const Wrapped = () =>
    tryClass(Client, {
      connect: {},
      url: { returnOnError: 'none' },
      send: {},
    });

  it('should return a newable whose instances catch through .try', () => {
    expect(new (Wrapped())('h').try.connect()).toBeNull();
  });

  it('should leave a direct call throwing its own error', () => {
    expect(() => new (Wrapped())('h').connect()).toThrow('refused');
  });

  it('should catch a mapped getter', () => {
    expect(new (Wrapped())('').try.url).toBe('none');
  });

  it('should hand back the real value on a successful call', () => {
    expect(new (Wrapped())('h').try.url).toBe('https://h');
  });

  it('should satisfy instanceof against the original', () => {
    expect(new (Wrapped())('h')).toBeInstanceOf(Client);
  });

  it('should resolve a member declared on a base class', () => {
    class Derived extends Client {}

    const derived = new (tryClass(Derived, { connect: {} }))('h');

    expect(Object.hasOwn(Derived.prototype, 'connect')).toBe(false);
    expect(derived.try.connect()).toBeNull();
  });

  it('should not hand back the original class', () => {
    expect(Wrapped()).not.toBe(Client);
  });

  it('should pass constructor arguments through', () => {
    expect(new (Wrapped())('h').host).toBe('h');
  });

  it('should run a direct call against a #private field', () => {
    expect(new (Wrapped())('h').send()).toBe('key');
  });

  it('should run a call through .try against a #private field', () => {
    expect(new (Wrapped())('h').try.send()).toBe('key');
  });

  it('should leave the original class untouched', () => {
    Wrapped();

    const client = new Client('h');

    expect('try' in client).toBe(false);
    expect(() => client.connect()).toThrow('refused');
  });

  it('should hand each instance the same map on every read', () => {
    const client = new (Wrapped())('h');

    expect(client.try).toBe(client.try);
  });

  it('should hand each instance a map of its own', () => {
    const Safe = Wrapped();

    expect(new Safe('a').try).not.toBe(new Safe('b').try);
    expect(new Safe('a').try.url).toBe('https://a');
  });

  it('should hand every instance the same manager', () => {
    const Safe = Wrapped();

    expect(new Safe('a').getTryManager()).toBe(new Safe('b').getTryManager());
  });

  it('should hide its names from inspection', () => {
    const client = new (Wrapped())('h');

    expect(Object.keys(client)).toEqual(Object.keys(new Client('h')));
    expect({ ...client }).toEqual({ ...new Client('h') });
    expect(JSON.stringify(client)).toBe(JSON.stringify(new Client('h')));
  });

  it('should refuse a write to try', () => {
    const client: any = new (Wrapped())('h');

    expect(() => {
      client.try = 1;
    }).toThrow(TypeError);
  });

  it('should refuse a write to getTryManager', () => {
    const client: any = new (Wrapped())('h');

    expect(() => {
      client.getTryManager = 1;
    }).toThrow(TypeError);
  });

  it('should keep two wraps of one class independent', () => {
    const A = tryClass(Client, { connect: { returnOnError: 'a' } });
    const B = tryClass(Client, { connect: { returnOnError: 'b' } });

    expect(new A('h').try.connect()).toBe('a');
    expect(new B('h').try.connect()).toBe('b');
  });

  it('should apply the third argument to every member', () => {
    const seen: string[] = [];

    const Safe = tryClass(
      Client,
      { connect: {}, url: {} },
      { runOnError: ({ property }) => void seen.push(property) },
    );

    const client = new Safe('');

    client.try.connect();
    void client.try.url;

    expect(seen).toEqual(['connect', 'url']);
  });

  it('should carry .try on an object the constructor returns instead', () => {
    const other = new Client('other');

    class Factory extends Client {
      constructor() {
        super('ignored');

        return other;
      }
    }

    const built = new (tryClass(Factory, { connect: {} }))();

    expect(built).toBe(other);
    expect(built.try.connect()).toBeNull();
  });
});

/**
 * A constructor that freezes, seals or prevents extensions on `this` leaves
 * nothing to define `.try` on, so the instance goes behind the raw-mode proxy
 * `tryWrap` uses — and keeps that proxy's limitation on direct calls.
 */
describe('tryClass and an instance its constructor locks', () => {
  class Frozen extends Client {
    constructor(host: string) {
      super(host);

      Object.freeze(this);
    }
  }

  class Sealed extends Client {
    constructor(host: string) {
      super(host);

      Object.seal(this);
    }
  }

  class NonExtensible extends Client {
    constructor(host: string) {
      super(host);

      Object.preventExtensions(this);
    }
  }

  it.each([
    ['frozen', Frozen],
    ['sealed', Sealed],
    ['non-extensible', NonExtensible],
  ])('should still carry .try on a %s instance', (_, Locked) => {
    const locked = new (tryClass(Locked, { connect: {}, send: {} }))('h');

    expect(locked.try.connect()).toBeNull();
    expect(locked.try.send()).toBe('key');
    expect(locked.getTryManager()).toBeDefined();
  });

  it('should still carry .try on a proxy whose defineProperty declines', () => {
    class Declining extends Client {
      constructor(host: string) {
        super(host);

        return new Proxy(this, { defineProperty: () => false });
      }
    }

    const declining = new (tryClass(Declining, { connect: {} }))('h');

    expect(declining.try.connect()).toBeNull();
    expect(Object.getOwnPropertyNames(declining)).toEqual(['host']);
  });

  it('should leave the instance as its constructor locked it', () => {
    const locked = new (tryClass(Frozen, { connect: {} }))('h');

    expect(Object.isFrozen(locked)).toBe(true);
    expect(Object.getOwnPropertyNames(locked)).toEqual(['host']);
  });

  it('should keep a direct call working', () => {
    const locked = new (tryClass(Frozen, { connect: {} }))('h');

    expect(() => locked.connect()).toThrow('refused');
    expect(locked.host).toBe('h');
  });

  /**
   * Pinned rather than wanted. `super()` hands the subclass the proxy as
   * `this`, so its `#private` field lands there, and `.try` runs against the
   * instance behind it — tracked in issue #78.
   */
  it("should hand back the fallback for a subclass's own #private field", () => {
    let caught: unknown;

    class Sub extends tryClass(Frozen, {
      connect: {
        runOnError: ({ error }) => {
          caught = error;
        },
      },
    }) {
      readonly #state = 'open';

      override connect(): string {
        return this.#state;
      }
    }

    const sub = new Sub('h');

    expect(sub.connect()).toBe('open');
    expect(sub.try.connect()).toBeNull();
    expect(caught).toBeInstanceOf(TypeError);
  });

  it('should satisfy instanceof against the original', () => {
    expect(new (tryClass(Frozen, { connect: {} }))('h')).toBeInstanceOf(Frozen);
  });

  /**
   * Pinned rather than wanted. The proxy is `this` on a direct call, which a
   * `#private` field rejects — the same limitation `tryWrap` has, tracked in
   * issue #57.
   */
  it('should fail a direct call against a #private field', () => {
    const locked = new (tryClass(Frozen, { send: {} }))('h');

    expect(() => locked.send()).toThrow(TypeError);
  });
});

/**
 * A cached client or a singleton comes back from every `new`. Its names were
 * defined the first time and cannot be defined again, and its identity is
 * what the constructor is there to keep.
 */
describe('tryClass and a constructor handing back an object it built before', () => {
  const shared = new Client('shared');

  class Singleton extends Client {
    constructor() {
      super('ignored');

      return shared;
    }
  }

  it('should hand the object back as it was the first time', () => {
    const Safe = tryClass(Singleton, { connect: {} });
    const first = new Safe();

    expect(new Safe()).toBe(first);
    expect(new Safe().try.connect()).toBeNull();
  });

  it('should answer for each wrap that hands it out', () => {
    const A = tryClass(Singleton, { connect: { returnOnError: 'a' } });
    const B = tryClass(Singleton, { connect: { returnOnError: 'b' } });

    expect(new A().try.connect()).toBe('a');
    expect(new B().try.connect()).toBe('b');
    expect(new A().try.connect()).toBe('a');
    expect(new B().getTryManager()).not.toBe(new A().getTryManager());
  });

  it('should hand back the same object each time through a second wrap', () => {
    const A = tryClass(Singleton, { connect: {} });
    const B = tryClass(Singleton, { connect: {} });

    void new A();

    expect(new B()).toBe(new B());
  });

  it('should hand back the same object each time when it is frozen', () => {
    const frozen = Object.freeze(new Client('frozen'));

    class Cached extends Client {
      constructor() {
        super('ignored');

        return frozen as Client;
      }
    }

    const Safe = tryClass(Cached, { connect: {} });

    expect(new Safe()).toBe(new Safe());
    expect(new Safe().try.connect()).toBeNull();
  });

  it('should hand back the same object each time when only one name took', () => {
    const halfDeclining = new Proxy(new Client('half'), {
      defineProperty: (target, property, descriptor) =>
        property !== 'getTryManager' &&
        Reflect.defineProperty(target, property, descriptor),
    });

    class Cached extends Client {
      constructor() {
        super('ignored');

        return halfDeclining;
      }
    }

    const Safe = tryClass(Cached, { connect: {} });

    expect(new Safe()).toBe(new Safe());
    expect(new Safe().try.connect()).toBeNull();
  });
});

/**
 * A constructor can hand back anything, a wrapper included. That wrapper
 * answers `try` for itself, so whatever this wrap defined would sit behind it
 * unreachable, with options nobody could reach.
 */
describe('tryClass and a constructor handing back a wrapper', () => {
  const refusal =
    "[TryError]: tryClass cannot equip an object that is already wrapped. The constructor handed one back, and its wrapper answers 'try' in place of this one — return the original object rather than a wrapper of it";

  it('should refuse a tryWrap wrapper', () => {
    class Wrapping extends Client {
      constructor() {
        super('h');

        return tryWrap(new Client('inner'), { connect: {} });
      }
    }

    expect(() => new (tryClass(Wrapping, { connect: {} }))()).toThrow(refusal);
  });

  it('should refuse a decorated instance', () => {
    @TryCatch()
    class Decorated {
      @Try()
      connect(): string {
        throw new Error('nope');
      }
    }

    class Wrapping extends Client {
      constructor() {
        super('h');

        return new Decorated() as any;
      }
    }

    expect(() => new (tryClass(Wrapping, { connect: {} }))()).toThrow(refusal);
  });
});

/**
 * The prototype is checked as the class is wrapped, but a constructor can give
 * the instance a `try` of its own, and defining the library's would replace it.
 */
describe('tryClass and an instance that declares a name it needs', () => {
  it.each(['try', 'getTryManager'])(
    'should refuse an instance its constructor gave its own %s',
    (name) => {
      class Claims extends Client {
        constructor() {
          super('h');

          Object.assign(this, { [name]: 'mine' });
        }
      }

      const Safe = tryClass(Claims, { connect: {} });

      expect(() => new Safe()).toThrow(
        `[TryError]: tryClass defines 'try' and 'getTryManager' on every instance it builds. Property '${name}' is already declared by the class or its constructor and would be replaced — reach it through the original class, or wrap a class that does not declare it`,
      );
    },
  );
});

describe('tryClass and a target it cannot wrap', () => {
  const twice =
    '[TryError]: tryClass cannot wrap a class that is already wrapped, decorated with @TryCatch, or extends one that is — its instances would be wrapped twice';

  @TryCatch()
  class Decorated {
    @Try()
    load(): string {
      throw new Error('nope');
    }
  }

  it('should refuse a class decorated with @TryCatch', () => {
    expect(() => tryClass(Decorated, { load: {} })).toThrow(twice);
  });

  it('should refuse a class extending a decorated one', () => {
    class Sub extends Decorated {}

    expect(() => tryClass(Sub, { load: {} })).toThrow(twice);
  });

  it('should refuse what tryClass handed back', () => {
    const Safe = tryClass(Client, { connect: {} });

    expect(() => tryClass(Safe, { connect: {} })).toThrow(twice);
  });

  it('should refuse @TryCatch applied to what tryClass handed back', () => {
    const Safe = tryClass(Client, { connect: {} });

    expect(() => TryCatch()(Safe)).toThrow(
      `[TryError]: @TryCatch cannot decorate a class tryClass handed back. 'Client' already equips its instances — decorate a subclass of it instead`,
    );
  });

  it('should refuse a class extending what tryClass handed back', () => {
    class Sub extends tryClass(Client, { connect: {} }) {}

    expect(() => tryClass(Sub, { connect: {} })).toThrow(twice);
  });

  it('should refuse an arrow function for having no prototype', () => {
    const arrow = () => ({});

    expect(() => tryClass(arrow as any, {})).toThrow(
      `[TryError]: tryClass needs a class. 'arrow' has no prototype to resolve members against — wrap an object with tryWrap instead`,
    );
  });

  it('should refuse a bound function for having no prototype', () => {
    const bound = Client.bind(null);

    expect(() => tryClass(bound, {})).toThrow(
      `[TryError]: tryClass needs a class. 'bound Client' has no prototype to resolve members against — wrap an object with tryWrap instead`,
    );
  });

  it.each(['try', 'getTryManager'])(
    'should refuse a class whose prototype declares %s',
    (name) => {
      class Claims extends Client {}

      Object.defineProperty(Claims.prototype, name, { value: () => 'mine' });

      expect(() => tryClass(Claims, { connect: {} })).toThrow(
        `[TryError]: tryClass defines 'try' and 'getTryManager' on every instance it builds. Property '${name}' is already declared by the class or its constructor`,
      );
    },
  );

  it('should refuse a member the try map answers itself', () => {
    expect(() => tryClass(Client, { toString: {} } as any)).toThrow(
      `[TryError]: The try map answers its own members before any catcher. Property 'toString' shares a name with one and would never catch — reach it on the target itself`,
    );
  });

  it('should refuse a member @CatchError already catches', () => {
    class Service {
      @CatchError({ returnOnError: 'inner' })
      load(): string {
        throw new Error('nope');
      }
    }

    expect(() => tryClass(Service, { load: {} })).toThrow(
      `[TryError]: tryClass cannot wrap a member @CatchError already catches. Property 'load' catches on its own, so it never throws and the options given here would never be reached`,
    );
  });

  it('should refuse a data property on the prototype', () => {
    class Configured extends Client {}

    Object.defineProperty(Configured.prototype, 'config', { value: 1 });

    expect(() => tryClass(Configured, { config: {} } as any)).toThrow(
      `[TryError]: Only methods and getters can be captured. Property 'config' holds a value that is not a function`,
    );
  });

  it('should refuse to construct for a newTarget with no prototype', () => {
    const Safe = tryClass(Client, { connect: {} });
    const bound = function Bound() {}.bind(null);

    expect(() => Reflect.construct(Safe, ['h'], bound)).toThrow(
      `[TryError]: tryClass needs a class. 'bound Bound' has no prototype to resolve members against — wrap an object with tryWrap instead`,
    );
  });

  it('should refuse before anything is constructed', () => {
    const built = jest.fn();

    class Watched extends Client {
      constructor() {
        super('h');

        built();
      }
    }

    expect(() => tryClass(Watched, { toString: {} } as any)).toThrow();
    expect(built).not.toHaveBeenCalled();
  });
});

describe('tryClass and the types it hands back', () => {
  // cspell:ignore conect
  it('should refuse a typo beside a real member', () => {
    expect(() =>
      // @ts-expect-error `conect` is not a member of Client
      tryClass(Client, { connect: {}, conect: {} }),
    ).toThrow(`Property 'conect' not supported`);
  });

  it('should refuse a member the map left out, read through .try', () => {
    const client = new (tryClass(Client, { connect: {} }))('h');

    // @ts-expect-error `url` was not mapped
    expect(() => client.try.url).toThrow();
  });

  it('should keep every other member typed as the original declares it', () => {
    const client = new (tryClass(Client, { connect: {} }))('h');

    const host: string = client.host;
    const sent: string = client.send();

    expect([host, sent]).toEqual(['h', 'key']);
  });

  it('should take only the constructor parameters the original does', () => {
    const Safe = tryClass(Client, { connect: {} });

    // @ts-expect-error Client takes a host
    expect(new Safe().host).toBeUndefined();
  });

  it('should keep an abstract class abstract, and extendable', () => {
    abstract class Shape {
      abstract name(): string;

      area(): number {
        throw new Error('no area');
      }
    }

    const Safe = tryClass(Shape, { area: {} });

    class Square extends Safe {
      name(): string {
        return 'square';
      }
    }

    // @ts-expect-error an abstract class cannot be constructed
    void (() => new Safe());

    const area: number | null = new Square().try.area();

    expect(area).toBeNull();
    expect(new Square()).toBeInstanceOf(Shape);
  });
});

describe('tryClass and the statics of the class it wraps', () => {
  class WithStatic {
    static readonly label = 'static';

    static fail(): string {
      throw new Error('static');
    }

    static viaThis(): WithStatic {
      return new this();
    }

    static viaName(): WithStatic {
      return new WithStatic();
    }

    m(): string {
      throw new Error('m');
    }
  }

  it('should keep a static readable and typed', () => {
    const label: string = tryClass(WithStatic, { m: {} }).label;

    expect(label).toBe('static');
  });

  it('should refuse a static in the member map', () => {
    expect(() =>
      // @ts-expect-error the map addresses the prototype, not the class
      tryClass(WithStatic, { viaThis: {} }),
    ).toThrow(`Property 'viaThis' not supported`);
  });

  it('should equip an instance a static builds with new this()', () => {
    const Safe = tryClass(WithStatic, { m: {} });

    expect((Safe.viaThis() as any).try.m()).toBeNull();
  });

  it('should take tryWrap over the result for its statics', () => {
    const Safe = tryWrap(tryClass(WithStatic, { m: {} }), { fail: {} });

    expect(() => Safe.fail()).toThrow('static');
    expect(Safe.try.fail()).toBeNull();
    expect(new Safe().try.m()).toBeNull();
    expect(new Safe()).toBeInstanceOf(WithStatic);
  });

  it('should hand new on the combination the manager the result hands out', () => {
    const Result = tryClass(WithStatic, { m: {} });
    const Safe = tryWrap(Result, { fail: {} });

    expect(new Safe().getTryManager()).toBe(new Result().getTryManager());
  });

  /**
   * Pinned rather than wanted. A static naming the original class constructs
   * the original, which nothing wraps — wrap what it returns with `tryWrap`.
   */
  it('should leave bare an instance a static builds by naming the original', () => {
    const Safe = tryClass(WithStatic, { m: {} });

    expect('try' in Safe.viaName()).toBe(false);
  });
});

/**
 * A catcher keeps the member it was built around, so a subclass sharing the
 * base's map would run the base's member through `.try` while a direct call
 * ran the override. Each subclass is resolved against its own prototype.
 */
describe('tryClass and a subclass', () => {
  const Base = tryClass(Client, { connect: {}, url: { returnOnError: 'none' } });

  it('should run the override through .try, not the original', () => {
    class Sub extends Base {
      override connect(): string {
        return 'sub';
      }
    }

    expect(new Sub('h').try.connect()).toBe('sub');
  });

  it('should catch what the override throws', () => {
    const seen: string[] = [];

    class Sub extends tryClass(
      Client,
      { connect: {} },
      { runOnError: ({ error }) => void seen.push(error.message) },
    ) {
      override connect(): string {
        throw new Error('sub refused');
      }
    }

    expect(new Sub('h').try.connect()).toBeNull();
    expect(seen).toEqual(['sub refused']);
  });

  it('should catch an overridden getter', () => {
    class Sub extends Base {
      override get url(): string {
        throw new Error('sub url');
      }
    }

    expect(new Sub('h').try.url).toBe('none');
  });

  it('should catch an inherited member on a subclass', () => {
    class Sub extends Base {}

    expect(new Sub('h').try.connect()).toBeNull();
  });

  it('should run an override declared further down the chain', () => {
    class Middle extends Base {
      override connect(): string {
        return 'middle';
      }
    }

    class Leaf extends Middle {}

    expect(new Leaf('h').try.connect()).toBe('middle');
    expect(new Middle('h').try.connect()).toBe('middle');
    expect(new Base('h').try.connect()).toBeNull();
  });

  it('should satisfy instanceof against the subclass and the original', () => {
    class Sub extends Base {}

    const sub = new Sub('h');

    expect(sub).toBeInstanceOf(Sub);
    expect(sub).toBeInstanceOf(Client);
  });

  it('should resolve each subclass once', () => {
    class Sub extends Base {}

    expect(new Sub('a').getTryManager()).toBe(new Sub('b').getTryManager());
    expect(new Sub('a').getTryManager()).not.toBe(new Base('b').getTryManager());
  });

  it('should refuse an override that cannot be captured, at first construction', () => {
    class Sub extends Base {}

    Object.defineProperty(Sub.prototype, 'connect', { value: 5 });

    expect(() => new Sub('h')).toThrow(
      `[TryError]: Only methods and getters can be captured. Property 'connect' holds a value that is not a function`,
    );
  });

  it('should refuse a subclass declaring try, before constructing anything', () => {
    const built = jest.fn();

    class Counted extends Client {
      constructor(host: string) {
        super(host);

        built();
      }
    }

    class Sub extends tryClass(Counted, { connect: {} }) {}

    Object.defineProperty(Sub.prototype, 'try', { value: () => 'mine' });

    expect(() => new Sub('h')).toThrow(
      `[TryError]: tryClass defines 'try' and 'getTryManager' on every instance it builds. Property 'try' is already declared by the class or its constructor`,
    );
    expect(built).not.toHaveBeenCalled();
  });

  /**
   * Pinned rather than wanted. A field is defined after `super()` returns, by
   * which time `try` is already on the instance and cannot be redefined.
   */
  it('should fail to construct a subclass with a try field', () => {
    class Sub extends Base {
      // @ts-expect-error the base already declares try, as a map
      try = 1;
    }

    expect(() => new Sub('h')).toThrow(TypeError);
  });
});

/**
 * A decorated subclass composes with what `tryClass` mapped on its base, as a
 * decorated subclass of a decorated base does: its `.try` answers for both.
 * From there on the subclass is the decorator's, so its overrides follow the
 * decorator's rule.
 */
/**
 * `Reflect.construct` can name any class as `newTarget`, and then no trap runs
 * but the one for the class actually constructed — so that one equips.
 */
describe('tryClass and a class named only as newTarget', () => {
  it('should equip for a subclass of another wrap of the same class', () => {
    const First = tryClass(Client, { connect: {} });
    const Second = tryClass(Client, { connect: {} });

    class Sub extends First {}

    const sub = Reflect.construct(Second, ['h'], Sub);

    expect(sub.try.connect()).toBeNull();
    expect(sub.getTryManager()).not.toBe(new Sub('h').getTryManager());
  });

  it('should equip for a decorated class whose trap never ran', () => {
    const Base = tryClass(Client, { connect: {} });

    @TryCatch()
    class Sub extends Base {}

    const sub = Reflect.construct(Base, ['h'], Sub);

    expect(sub).toBeInstanceOf(Sub);
    expect(sub.try.connect()).toBeNull();
  });
});

/**
 * `tryWrap` over the result stands in front of it, and passes
 * `Object.getPrototypeOf` straight through to it — so a walk up a subclass's
 * chain would step past the wrap without seeing it, were the stand-in not
 * filed as the class it stands for.
 */
describe('tryClass behind tryWrap, and what extends it', () => {
  const Safe = () =>
    tryWrap(tryClass(Client, { connect: {} }), {}) as unknown as typeof Client;

  it('should hand a decorated subclass the members mapped on the wrap', () => {
    @TryCatch()
    class Sub extends Safe() {
      @Try()
      own(): string {
        throw new Error('own');
      }
    }

    const sub = new Sub('h') as any;

    expect(sub.try.connect()).toBeNull();
    expect(sub.try.own()).toBeNull();
  });

  it('should equip an undecorated subclass', () => {
    class Sub extends Safe() {}

    expect((new Sub('h') as any).try.connect()).toBeNull();
  });

  it('should refuse tryClass on a subclass of it', () => {
    class Sub extends Safe() {}

    expect(() => tryClass(Sub, { send: {} })).toThrow(
      `[TryError]: tryClass cannot wrap a class that is already wrapped`,
    );
  });

  it('should refuse @TryCatch on the stand-in itself, as on the result', () => {
    expect(() => TryCatch()(Safe())).toThrow(
      `[TryError]: @TryCatch cannot decorate a class tryClass handed back`,
    );
  });
});

describe('tryClass and a subclass decorated with @TryCatch', () => {
  const Base = () =>
    tryClass(Client, { connect: {}, url: { returnOnError: 'none' } });

  it('should answer for its own members and the ones mapped on the base', () => {
    @TryCatch()
    class Sub extends Base() {
      @Try()
      own(): string {
        throw new Error('own');
      }
    }

    const sub = new Sub('') as any;

    expect(sub.try.connect()).toBeNull();
    expect(sub.try.url).toBe('none');
    expect(sub.try.own()).toBeNull();
  });

  it('should equip the instance once, through the decorator', () => {
    @TryCatch()
    class Sub extends Base() {}

    const sub = new Sub('h') as any;

    expect(Object.getOwnPropertyNames(sub)).toEqual(['host']);
    expect(sub.getTryManager()).toBe(new Sub('x').getTryManager());
  });

  it('should keep a member the decorator catches catching on a direct call', () => {
    @TryCatch()
    class Sub extends Base() {
      @Catch({ returnOnError: 'caught' })
      own(): string {
        throw new Error('own');
      }
    }

    expect(new Sub('h').own()).toBe('caught');
  });

  it('should catch an override decorated with @Try, running the override', () => {
    @TryCatch()
    class Sub extends Base() {
      @Try()
      override connect(): string {
        return 'sub';
      }
    }

    expect((new Sub('h') as any).try.connect()).toBe('sub');
  });

  it('should refuse an undecorated override through .try, as the decorator does', () => {
    @TryCatch()
    class Sub extends Base() {
      override connect(): string {
        return 'sub';
      }
    }

    expect(() => (new Sub('h') as any).try.connect()).toThrow(
      `Property 'connect' does not exist in TryMap`,
    );
  });

  it('should equip an undecorated subclass of it once, through the decorator', () => {
    @TryCatch()
    class Middle extends Base() {
      @Try()
      own(): string {
        throw new Error('own');
      }
    }

    class Leaf extends Middle {}

    const leaf = new Leaf('h') as any;

    expect(Object.getOwnPropertyNames(leaf)).toEqual(['host']);
    expect(leaf.try.connect()).toBeNull();
    expect(leaf.try.own()).toBeNull();
  });

  /**
   * Pinned rather than wanted. The decorator hands each instance out behind
   * its proxy, which is `this` on every call — so a `#private` field throws
   * there, as it does under `@TryCatch` on any class declaring one.
   */
  it('should fail a call against a #private field, as the decorator does', () => {
    @TryCatch()
    class Sub extends tryClass(Client, { send: {} }) {}

    expect(() => new Sub('h').send()).toThrow(TypeError);
    expect((new Sub('h') as any).try.send()).toBeNull();
  });

  /**
   * Pinned rather than wanted. Built under the decorator's `new.target`, the
   * object is taken for the one `super()` builds and left for the decorator,
   * which wraps only what `super()` returned — tracked in issue #77.
   */
  it('should leave bare an object built for new.target before super()', () => {
    const Wrapped = Base();
    let saved: any;

    @TryCatch()
    class Sub extends Wrapped {
      constructor(host: string) {
        saved = Reflect.construct(Wrapped, [host], new.target);

        super(host);
      }
    }

    const sub = new Sub('h') as any;

    expect(sub.try.connect()).toBeNull();
    expect(saved).toBeInstanceOf(Sub);
    expect(saved.try).toBeUndefined();
  });

  it('should leave the base wrap equipping its own instances', () => {
    const Wrapped = Base();

    @TryCatch()
    class Sub extends Wrapped {}

    void new Sub('h');

    expect(Object.getOwnPropertyNames(new Wrapped('h'))).toContain('try');
  });
});

/**
 * Nothing stands in front of the instance, so a builtin's internal slots see
 * the object they belong to on every call — the case `tryWrap` cannot cover.
 */
describe('tryClass and a builtin', () => {
  it('should leave a direct call working, which tryWrap cannot', () => {
    const map = new (tryClass(Map<string, number>, { get: {} }))([['a', 1]]);

    expect(map.get('a')).toBe(1);
    expect(map.size).toBe(1);
    expect(map.try.get('a')).toBe(1);
  });

  it('should equip a subclass of a builtin', () => {
    class Registry extends Map<string, number> {
      require(key: string): number {
        if (!this.has(key)) {
          throw new Error(`no ${key}`);
        }

        return this.get(key)!;
      }
    }

    const registry = new (tryClass(Registry, { require: {} }))();

    registry.set('a', 1);

    expect(registry.try.require('a')).toBe(1);
    expect(registry.try.require('b')).toBeNull();
  });
});

describe('tryClass and what other entry points make of its instances', () => {
  it('should leave tryWrap refusing an instance, which already carries try', () => {
    const client = new (tryClass(Client, { connect: {} }))('h');

    expect(() => tryWrap(client, { url: {} })).toThrow(
      `[TryError]: tryWrap resolves 'try' and 'getTryManager' before the target sees them. Property 'try' is declared on the target`,
    );
  });

  /**
   * Pinned rather than wanted. A field lives on each instance rather than the
   * prototype, which is where the map is resolved, so `.try` runs the method
   * the field shadows. Nothing refuses it at compile time either: the type
   * `tryClass` hands back does not say which of its members are methods.
   */
  it('should run the method, not a field overriding it, through .try', () => {
    class Sub extends tryClass(Client, { connect: {} }) {
      connect = () => 'field';
    }

    const sub = new Sub('h');

    expect(sub.connect()).toBe('field');
    expect(sub.try.connect()).toBeNull();
  });
});
