import type { TryManager as TryManagerType } from '../src';
import { TryManager } from '../src/manager';
import { tryWrap, TryCatch, Try, CatchError } from '../src';
import type { TryCatchExtension, TryMembers } from '../src';

const boom = Symbol('boom');

describe('tryWrap', () => {
  describe('a namespace object', () => {
    const json = () => tryWrap(JSON, { parse: { returnOnError: {} } });

    it('should leave a direct call throwing', () => {
      expect(() => json().parse('nope')).toThrow(SyntaxError);
    });

    it('should catch through .try', () => {
      expect(json().try.parse('nope')).toEqual({});
    });

    it('should hand back the real value on a successful call', () => {
      expect(json().try.parse('{"a":"b"}')).toEqual({ a: 'b' });
    });

    it('should not hand back the target itself', () => {
      expect(json()).not.toBe(JSON);
    });

    it('should leave the target untouched', () => {
      json();

      expect(() => JSON.parse('nope')).toThrow(SyntaxError);
    });
  });

  /**
   * A builtin with internal slots rejects a Proxy as `this`, and the catcher
   * catches that rejection — so a wrapped `Map` whose catcher ran against the
   * proxy would report every key as a failure, including the ones that are
   * there. The successful call is the guard, not the caught one.
   */
  describe('a builtin with internal slots', () => {
    const wrapped = () =>
      tryWrap(new Map([['a', 1]]), { get: { returnOnError: 'FALLBACK' } });

    it('should hand back the real value on a successful get', () => {
      expect(wrapped().try.get('a')).toBe(1);
    });

    it('should resolve an inherited member off the prototype chain', () => {
      expect(wrapped().try.get('missing')).toBeUndefined();
    });
  });
});

describe('tryWrap on an instance you did not declare', () => {
  class Client {
    constructor(private readonly host: string) {}

    get url(): string {
      if (!this.host) {
        throw new Error('no host configured');
      }

      return `https://${this.host}`;
    }

    fetchUser(id: string): string {
      throw new Error(`no user ${id}`);
    }

    listUsers(): string[] {
      throw new Error('unreachable');
    }
  }

  describe('an inherited accessor', () => {
    it('should resolve off the prototype chain and run against the instance', () => {
      const client = tryWrap(new Client('example.com'), { url: {} });

      expect(client.try.url).toBe('https://example.com');
    });

    it('should catch what the accessor throws', () => {
      const client = tryWrap(new Client(''), {
        url: { returnOnError: 'about:blank' },
      });

      expect(client.try.url).toBe('about:blank');
    });

    it('should leave a direct read throwing', () => {
      const client = tryWrap(new Client(''), { url: {} });

      expect(() => client.url).toThrow('no host configured');
    });
  });

  describe('options', () => {
    it('should keep each member independent', () => {
      const client = tryWrap(new Client('example.com'), {
        fetchUser: { returnOnError: null },
        listUsers: { returnOnError: [] },
      });

      expect(client.try.fetchUser('7')).toBeNull();
      expect(client.try.listUsers()).toEqual([]);
    });

    it('should apply the third argument to every member', () => {
      const seen: string[] = [];

      const client = tryWrap(
        new Client('example.com'),
        { fetchUser: {}, listUsers: {} },
        { runOnError: ({ property }) => void seen.push(property) },
      );

      client.try.fetchUser('7');
      client.try.listUsers();

      expect(seen).toEqual(['fetchUser', 'listUsers']);
    });

    it('should let a member override the third argument', () => {
      const client = tryWrap(
        new Client('example.com'),
        { fetchUser: { runOnError: () => 'member' } },
        { runOnError: () => 'class-wide' },
      );

      expect(client.try.fetchUser('7')).toBe('member');
    });
  });

  describe('a rejected promise', () => {
    class Remote {
      async load(): Promise<string> {
        throw new Error('offline');
      }
    }

    it('should catch the rejection, matching the decorators', async () => {
      const remote = tryWrap(new Remote(), { load: { returnOnError: 'cached' } });

      await expect(remote.try.load()).resolves.toBe('cached');
    });
  });

  describe('two independent wraps of one target', () => {
    it('should give each its own map without either observing the other', () => {
      const client = new Client('example.com');

      const first = tryWrap(client, { fetchUser: { returnOnError: 'first' } });
      const second = tryWrap(client, { listUsers: { returnOnError: ['second'] } });

      expect(first.try.fetchUser('1')).toBe('first');
      expect(second.try.listUsers()).toEqual(['second']);
      expect(first).not.toBe(second);
    });

    it('should leave a member wrapped by the other call off this map', () => {
      const client = new Client('example.com');

      const first = tryWrap(client, { fetchUser: {} });

      tryWrap(client, { listUsers: {} });

      expect(() => (first.try as any).listUsers()).toThrow(
        `[TryError]: Property 'listUsers' does not exist in TryMap`,
      );
    });
  });
});

describe('tryWrap and a target that cannot be written to', () => {
  const build = () =>
    Object.freeze({
      load(): string {
        throw new Error('nope');
      },
    });

  it('should wrap a frozen target', () => {
    const frozen = build();

    expect(tryWrap(frozen, { load: { returnOnError: 'fallback' } }).try.load()).toBe(
      'fallback',
    );
  });

  it('should wrap a sealed target', () => {
    const sealed = Object.seal({
      load(): string {
        throw new Error('nope');
      },
    });

    expect(tryWrap(sealed, { load: { returnOnError: 'fallback' } }).try.load()).toBe(
      'fallback',
    );
  });

  it('should leave the member on the target as it found it', () => {
    const frozen = build();
    const original = frozen.load;

    tryWrap(frozen, { load: {} });

    expect(frozen.load).toBe(original);
    expect(() => frozen.load()).toThrow('nope');
  });
});

describe('tryWrap and the members it exposes', () => {
  it('should reject a key that was never mapped', () => {
    const json = tryWrap(JSON, { parse: {} });

    // the directive is half the assertion: it only compiles while `.try`
    // leaves a member out of its type when the map left it out. The message
    // is what the same access does at runtime.
    expect(() =>
      // @ts-expect-error 'stringify' was never mapped
      json.try.stringify('{}'),
    ).toThrow(`[TryError]: Property 'stringify' does not exist in TryMap`);
  });

  it('should reject an unknown key at compile time', () => {
    // the directive is half the assertion: it only compiles while a key
    // outside `keyof T` is an error. The message is what the same call does
    // at runtime, for anyone reaching this from JavaScript.
    expect(() =>
      // @ts-expect-error 'nope' is not a member of JSON
      tryWrap(JSON, { nope: {} }),
    ).toThrow(
      `[TryError]: Only methods and accessors can be captured. Property 'nope' not supported`,
    );
  });

  it('should reject an unknown key beside a known one at compile time', () => {
    // the map above shares no key with `TryMembers<JSON>`, which the
    // constraint refuses on its own. One real key beside the typo is what
    // gets past it, so this is the case the signature has to answer for.
    expect(() =>
      // @ts-expect-error 'nope' is not a member of JSON
      tryWrap(JSON, { parse: {}, nope: {} }),
    ).toThrow(
      `[TryError]: Only methods and accessors can be captured. Property 'nope' not supported`,
    );
  });

  it('should accept a member map forwarded by a generic caller', () => {
    // compiling is the assertion: the guard against a stray key hands back
    // `unknown` for a map typed `TryMembers<T>`, whose keys provably belong,
    // where a bare `Record` of an `Exclude` over a generic never simplifies
    const forward = <T extends object>(target: T, members: TryMembers<T>) =>
      tryWrap(target, members);

    expect(
      forward(JSON, { parse: { returnOnError: {} } }).try.parse('nope'),
    ).toEqual({});
  });

  it('should keep a map checked with satisfies to the members it names', () => {
    // an annotation would widen the map to every member of JSON; the directive
    // only compiles while `satisfies` leaves it as written
    const members = { parse: { returnOnError: {} } } satisfies TryMembers<JSON>;
    const json = tryWrap(JSON, members);

    expect(json.try.parse('nope')).toEqual({});
    expect(() =>
      // @ts-expect-error 'stringify' was never mapped
      json.try.stringify({}),
    ).toThrow(`Property 'stringify' does not exist in TryMap`);
  });

  it('should expose getTryManager on the wrapped object', () => {
    const json = tryWrap(JSON, { parse: {} });

    const manager: TryManagerType<JSON, 'parse'> = json.getTryManager();

    expect(manager).toBeInstanceOf(TryManager);
  });
});

/**
 * Classification is a runtime matter: a getter and a data property have the
 * same type, so the member map cannot exclude one. All three rejections are
 * pinned together because the messages differ by what the descriptor turned out
 * to be, and only one of the three can arrive through a decorator.
 */
describe('tryWrap and a member that cannot be wrapped', () => {
  it('should reject a data property for holding a value it cannot wrap', () => {
    const target = { config: 1 };

    expect(() => tryWrap(target, { config: {} })).toThrow(
      `[TryError]: Only methods and getters can be captured. Property 'config' holds a value that is not a function`,
    );
  });

  it('should reject a setter with no getter', () => {
    const target = {
      set thing(_value: string) {},
    };

    expect(() => tryWrap(target, { thing: {} })).toThrow(
      `[TryError]: Only methods and getters can be captured. Property 'thing' has no value or getter to wrap`,
    );
  });

  it('should reject a member the target does not actually have', () => {
    const target = {} as { load(): string };

    expect(() => tryWrap(target, { load: {} })).toThrow(
      `[TryError]: Only methods and accessors can be captured. Property 'load' not supported`,
    );
  });
});

/**
 * A type declaring `toString`, as `Date`, `URL` and many a class do, put that
 * key in the member map's type, and TypeScript checks an object literal against
 * it with the literal's own inherited `toString` — which is not an options
 * object. No map for such a type compiled, whatever member it named.
 */
describe('tryWrap and a type declaring a member Object also has', () => {
  it('should wrap a member of a type that declares toString', () => {
    const date = tryWrap(new Date(0), { getTime: {} });

    expect(date.try.getTime()).toBe(0);
  });

  it('should reject the shared member beside a real one at compile time', () => {
    // one real key is what gets a literal past the constraint, so this is the
    // case the signature's guard has to answer for, as with a typo
    expect(() =>
      // @ts-expect-error the .try map answers toString itself
      tryWrap(new Date(0), { getTime: {}, toString: {} }),
    ).toThrow(`Property 'toString' shares a name with one and would never catch`);
  });
});

/**
 * `try` and `getTryManager` are resolved by the wrapper before anything is
 * forwarded to the target, so a target declaring either one has that member
 * quietly replaced. The author of a decorated class can rename theirs; whoever
 * was handed an SDK client cannot, which is why this is refused rather than
 * documented.
 */
describe('tryWrap and a target that already uses the names it needs', () => {
  const load = () => {
    throw new Error('nope');
  };

  it('should reject a target with its own try member', () => {
    const target = { load, try: () => 'mine' };

    expect(() => tryWrap(target, { load: {} })).toThrow(
      `[TryError]: tryWrap resolves 'try' and 'getTryManager' before the target sees them. Property 'try' is declared on the target and would be unreachable through the wrapper — reach it on the target itself, or wrap an object that does not declare it`,
    );
  });

  it('should reject a target with its own getTryManager member', () => {
    const target = { load, getTryManager: () => 'mine' };

    expect(() => tryWrap(target, { load: {} })).toThrow(
      `Property 'getTryManager' is declared on the target`,
    );
  });

  it('should reject a target that inherits the name rather than owning it', () => {
    class Base {
      try(): string {
        return 'mine';
      }
    }

    class Client extends Base {
      load(): string {
        throw new Error('nope');
      }
    }

    expect(() => tryWrap(new Client(), { load: {} })).toThrow(
      `Property 'try' is declared on the target`,
    );
  });
});

/**
 * Two wraps of the same raw target are fine — nothing is written to it, so
 * neither can affect the other. Wrapping a wrapper is not: the outer catchers
 * would run against the inner proxy, which is the incompatible-receiver failure
 * the raw-receiver decision exists to prevent, arriving silently and only for
 * builtins.
 */
describe('tryWrap on something already wrapped', () => {
  it('should reject a target it wrapped itself', () => {
    const wrapped = tryWrap(
      {
        load(): string {
          throw new Error('nope');
        },
      },
      { load: {} },
    );

    expect(() => tryWrap(wrapped, { load: {} })).toThrow(
      `[TryError]: tryWrap cannot wrap an object that is already wrapped, or one that inherits from a wrapper. The outer catchers would run against the inner wrapper rather than the target, which a builtin rejects as an incompatible receiver — wrap the original target once, with every member it needs`,
    );
  });

  it('should reject a decorated instance, which is already wrapped', () => {
    @TryCatch<Decorated>()
    class Decorated {
      @Try<Decorated>()
      load(): string {
        throw new Error('nope');
      }
    }

    expect(() => tryWrap(new Decorated(), { load: {} })).toThrow(
      `[TryError]: tryWrap cannot wrap an object that is already wrapped, or one that inherits from a wrapper.`,
    );
  });

  /**
   * The member is found by walking up from the target, so an inner wrapper
   * standing in the chain is walked straight through: registration lands on
   * whatever declared the member, and the catcher then runs it against an
   * object that is not the one the inner wrapper stands in front of. Checking
   * the target alone let that through.
   */
  it('should reject a target that inherits from a wrapper', () => {
    const inner = tryWrap(new Map<string, number>([['a', 1]]), { get: {} });

    expect(() =>
      tryWrap(Object.create(inner) as Map<string, number>, {
        get: { returnOnError: 'FALLBACK' },
      }),
    ).toThrow(`or one that inherits from a wrapper`);
  });
});

/**
 * `.try` resolves its own members before any catcher, so a member sharing a
 * name with one is answered by the map and never catches. The decorators leave
 * this documented — issue #34 — because a class can rename its member and
 * refusing would reject classes that work today. Nothing can be renamed on
 * somebody else's object, and the whole member list is here before anything has
 * run, so it is refused instead of returning a plausible wrong answer.
 */
describe('tryWrap and a member the try map answers itself', () => {
  it('should reject a member named after one of Object.prototype', () => {
    const target = {
      toString(): string {
        throw new Error('boom');
      },
    };

    // the directive is half the assertion: the map's type leaves out the names
    // `Object` declares, so this is refused before it runs as well as when it
    // does. The message is what JavaScript gets.
    expect(() =>
      // @ts-expect-error the .try map answers toString itself
      tryWrap(target, { toString: { returnOnError: 'caught' } }),
    ).toThrow(
      `[TryError]: The try map answers its own members before any catcher. Property 'toString' shares a name with one and would never catch — reach it on the target itself`,
    );
  });

  it("should reject a member named after one of the map's own", () => {
    const target = {
      getTryCatcher(): string {
        throw new Error('boom');
      },
    };

    expect(() => tryWrap(target, { getTryCatcher: {} })).toThrow(
      `Property 'getTryCatcher' shares a name with one and would never catch`,
    );
  });

  /**
   * The contrast that says why the refusal above lives here and not in the
   * registration every path shares. A decorated class reaches the same
   * shadowing and is left with it: the author can rename the member, and
   * refusing would reject classes that work today, however oddly. Pinned so
   * that closing issue #34 has to come past this test.
   */
  it('should leave a decorated class shadowed rather than refuse it', () => {
    interface Shadowed extends TryCatchExtension<Shadowed, 'toString'> {}

    @TryCatch<Shadowed>()
    class Shadowed {
      @Try<Shadowed>({ returnOnError: 'caught' })
      toString(): string {
        throw new Error('boom');
      }
    }

    expect(new Shadowed().try.toString()).toBe('[object Object]');
  });

  it('should leave an ordinary member alone', () => {
    const target = {
      load(): string {
        throw new Error('nope');
      },
    };

    expect(tryWrap(target, { load: { returnOnError: 'caught' } }).try.load()).toBe(
      'caught',
    );
  });
});

/**
 * A member `@CatchError` already catches answers every call itself and yields
 * its own fallback, so nothing ever reaches a catcher built around it. The
 * registration refuses it either way; this is about the message, which
 * otherwise names decorators the caller never applied.
 */
describe('tryWrap and a member already caught by @CatchError', () => {
  it('should refuse it in its own terms', () => {
    class Service {
      @CatchError({ returnOnError: 'inner' })
      load(): string {
        throw new Error('nope');
      }
    }

    expect(() =>
      tryWrap(new Service(), { load: { returnOnError: 'outer' } }),
    ).toThrow(
      `[TryError]: tryWrap cannot wrap a member @CatchError already catches. Property 'load' catches on its own, so it never throws and the options given here would never be reached`,
    );
  });
});

/**
 * A proxy carrying only a `get` trap still forwards writes, so assigning `try`
 * through the wrapper defined a real `try` property on the target: unreadable
 * through the wrapper, visible to everything else holding the reference, and
 * enough to make a later wrap refuse a name this library planted.
 */
describe('tryWrap and a write through the wrapper', () => {
  const build = () => {
    const target: Record<string, any> = {
      load(): string {
        throw new Error('nope');
      },
    };

    return { target, wrapped: tryWrap(target, { load: {} }) as any };
  };

  it('should refuse a write to try and leave the target alone', () => {
    const { target, wrapped } = build();

    expect(() => {
      wrapped.try = 'clobber';
    }).toThrow(
      `[TryError]: The wrapper answers 'try' and 'getTryManager' itself and cannot pass a write of either through. Property 'try' would be set on the target where nothing could read it back — assign it on the target directly if that is what you mean`,
    );

    expect('try' in target).toBe(false);
  });

  it('should refuse a write to getTryManager', () => {
    const { target, wrapped } = build();

    expect(() => {
      wrapped.getTryManager = 'clobber';
    }).toThrow(`Property 'getTryManager' would be set on the target`);

    expect('getTryManager' in target).toBe(false);
  });

  it('should pass an ordinary write through to the target', () => {
    const { target, wrapped } = build();

    wrapped.label = 'set through the wrapper';

    expect(target.label).toBe('set through the wrapper');
    expect(wrapped.label).toBe('set through the wrapper');
  });
});

/**
 * Optional call syntax guards `null` and `undefined` alone, so an ordinary
 * object carrying a `catch` key threw a `TypeError` from inside the catcher,
 * which the catcher's own try block then caught: a successful call came back as
 * the fallback, with `runOnError` fired on an error nothing raised. Nothing
 * about parsed data is under the caller's control, which is what makes it
 * reachable here rather than merely possible.
 */
describe('tryWrap and a returned value carrying a catch key', () => {
  it('should hand back the value rather than catch it', () => {
    const errors: string[] = [];

    const wrapped = tryWrap(
      {
        load(): unknown {
          return { catch: 'not a function', data: 7 };
        },
      },
      {
        load: {
          returnOnError: 'FALLBACK',
          runOnError: ({ error }) => void errors.push(error.message),
        },
      },
    );

    expect(wrapped.try.load()).toEqual({ catch: 'not a function', data: 7 });
    expect(errors).toEqual([]);
  });

  it('should parse a payload with a catch key', () => {
    const json = tryWrap(JSON, { parse: { returnOnError: 'FALLBACK' } });

    expect(json.try.parse('{"catch":1,"a":2}')).toEqual({ catch: 1, a: 2 });
  });

  it('should still catch a rejected promise', async () => {
    const wrapped = tryWrap(
      {
        load(): Promise<string> {
          return Promise.reject(new Error('nope'));
        },
      },
      { load: { returnOnError: 'caught' } },
    );

    await expect(wrapped.try.load()).resolves.toBe('caught');
  });
});

describe('tryWrap and a symbol-named member', () => {
  it('should register it like any other', () => {
    const target = {
      [boom](): string {
        throw new Error('boom');
      },
    };

    const wrapped = tryWrap(target, { [boom]: { returnOnError: 'caught' } });

    expect(wrapped.try[boom]()).toBe('caught');
  });
});

/**
 * Documents a limitation, not a guarantee.
 *
 * Resolving the receiver to the raw target fixes the `.try` path, and cannot fix
 * the direct one: `wrapped.get('a')` is a method call on the wrapper, so `this`
 * is the wrapper whatever the access handed back. A builtin rejects that, and
 * nothing catches it here — a direct call is meant to throw, so the throw
 * arrives as designed, just with the wrong error in it.
 *
 * Reach a builtin's members through `.try`, or hold the target itself for the
 * calls that should throw.
 */
describe('a direct call through a wrapped builtin', () => {
  it('should fail on the receiver rather than run', () => {
    const map = tryWrap(new Map([['a', 1]]), { get: {} });

    expect(() => map.get('a')).toThrow(
      'Method Map.prototype.get called on incompatible receiver',
    );
    expect(map.try.get('a')).toBe(1);
  });
});
