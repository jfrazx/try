import { tryFn, tryWrap } from '../src';

const NOT_A_FUNCTION = `[TryError]: tryFn needs a function. Received object — wrap an object's members with tryWrap instead`;
const WRAPPED = `[TryError]: tryFn cannot wrap a function that is already wrapped, or one that inherits from a wrapper. Its .try would hide the one the wrapper already answers — wrap the original function once`;
const RESERVED = `[TryError]: tryFn answers 'try' before the function sees it. Property 'try' is declared on the function and would be unreachable through the wrapper — reach it on the function itself, or wrap a function that does not declare it`;
const WRITE = `[TryError]: tryFn answers 'try' itself and cannot pass a write of it through. Property 'try' would be set on the function where nothing could read it back — assign it on the function directly if that is what you mean`;

function thrower(): void {
  throw new Error('x');
}

function self(this: unknown): unknown {
  return this;
}

describe('tryFn', () => {
  const parse = () => tryFn(JSON.parse, { returnOnError: {} });

  it('should leave a direct call throwing', () => {
    expect(() => parse()('nope')).toThrow(SyntaxError);
  });

  it('should catch through .try', () => {
    expect(parse().try('nope')).toEqual({});
  });

  it('should hand back the real value', () => {
    expect(parse().try('{"a":"b"}')).toEqual({ a: 'b' });
  });

  it('should hand back null by default', () => {
    expect(tryFn(JSON.parse).try('nope')).toBeNull();
  });

  it('should leave the function untouched', () => {
    parse();

    expect('try' in JSON.parse).toBe(false);
  });

  it('should hand back the same .try on every read', () => {
    const wrapped = parse();

    expect(wrapped.try).toBe(wrapped.try);
  });

  it('should catch a function declaration', () => {
    expect(tryFn(thrower).try()).toBeNull();
  });

  it('should catch an arrow function', () => {
    expect(
      tryFn((): never => {
        throw new Error('x');
      }).try(),
    ).toBeNull();
  });

  it('should carry no getTryManager', () => {
    expect((parse() as any).getTryManager).toBeUndefined();
  });

  /**
   * Documented rather than detected: the direct call throws the same error
   * loudly first, and `tryClass` is the entry point for a class.
   */
  it('should catch a class called without new', () => {
    expect((tryFn(class {} as any) as any).try()).toBeNull();
  });

  describe('arguments', () => {
    const echo = () => tryFn((...args: unknown[]) => args);

    it('should pass every argument in order', () => {
      expect(echo().try(1, 'two', [3])).toEqual([1, 'two', [3]]);
    });

    it('should pass a single argument as itself', () => {
      expect(echo().try([1, 2])).toEqual([[1, 2]]);
    });
  });

  describe('runOnError', () => {
    const err = new Error('failed');

    function load(_a: number, _b: number): never {
      throw err;
    }

    it('should name a named function', () => {
      const runOnError = jest.fn();

      tryFn(load, { runOnError }).try(1, 2);

      expect(runOnError).toHaveBeenCalledWith(
        expect.objectContaining({ property: 'load', error: err, arguments: [1, 2] }),
      );
    });

    it('should name an anonymous one "anonymous"', () => {
      const runOnError = jest.fn();

      tryFn(
        (): never => {
          throw err;
        },
        { runOnError },
      ).try();

      expect(runOnError).toHaveBeenCalledWith(
        expect.objectContaining({ property: 'anonymous' }),
      );
    });

    it("should keep a bound function's name", () => {
      const runOnError = jest.fn();

      tryFn(load.bind(null), { runOnError }).try(1, 2);

      expect(runOnError).toHaveBeenCalledWith(
        expect.objectContaining({ property: 'bound load' }),
      );
    });
  });

  describe('a rejected promise', () => {
    it('should catch the rejection', async () => {
      await expect(
        tryFn(
          async () => {
            throw new Error('x');
          },
          { returnOnError: 'fallback' },
        ).try(),
      ).resolves.toBe('fallback');
    });

    it('should leave a direct call rejecting', async () => {
      await expect(
        tryFn(async () => {
          throw new Error('x');
        })(),
      ).rejects.toThrow('x');
    });
  });

  describe('what the wrapper carries', () => {
    function Point(this: { x: number }, x: number): void {
      this.x = x;
    }

    it('should keep name and length', () => {
      function pair(_a: unknown, _b: unknown): void {}

      const wrapped = tryFn(pair);

      expect(wrapped.name).toBe('pair');
      expect(wrapped.length).toBe(2);
    });

    it("should keep the function's own properties", () => {
      const debounced = Object.assign(() => {}, { cancel: () => 'cancelled' });

      expect(tryFn(debounced).cancel()).toBe('cancelled');
    });

    it('should wrap a frozen function', () => {
      expect(
        tryFn(
          Object.freeze(function frozen(): void {
            throw new Error('x');
          }),
        ).try(),
      ).toBeNull();
    });

    it('should construct as the original does', () => {
      const point = new (tryFn(Point) as any)(1);

      expect(point).toBeInstanceOf(Point);
      expect(point.x).toBe(1);
    });

    /**
     * A bound function has no `prototype` of its own. It builds the function
     * it was bound from only when it is `new.target` itself, so a wrapper
     * arriving there in its place built a plain object instead.
     */
    it('should construct a bound function as the function it was bound from', () => {
      const point = new (tryFn(Point.bind({ x: 0 })) as any)(1);

      expect(point).toBeInstanceOf(Point);
      expect(point.x).toBe(1);
    });

    /** As for `tryWrap`: nothing rewrites the `new.target` a constructor sees. */
    it('should keep the wrapper as new.target', () => {
      function Target(this: { target: unknown }): void {
        this.target = new.target;
      }

      const Wrapped = tryFn(Target) as any;

      expect(new Wrapped().target).toBe(Wrapped);
    });

    it('should read as native code when stringified', () => {
      expect(String(tryFn(thrower))).toContain('[native code]');
    });
  });

  describe('this', () => {
    it('should run .try with this undefined', () => {
      expect(tryFn(self).try()).toBeUndefined();
    });

    it('should run a detached .try with this undefined', () => {
      const { try: attempt } = tryFn(self);

      expect(attempt()).toBeUndefined();
    });

    it('should honour .try.call', () => {
      const obj = {};

      expect(tryFn(self).try.call(obj)).toBe(obj);
    });

    it('should run a direct call against the object it is installed on', () => {
      const obj = { self: tryFn(self) };

      expect(obj.self()).toBe(obj);
    });
  });

  describe('what tryFn refuses', () => {
    it('should refuse something that is not a function', () => {
      expect(() => tryFn({} as any)).toThrow(NOT_A_FUNCTION);
    });

    it('should refuse a tryWrap result', () => {
      expect(() => tryFn(tryWrap(thrower, {}))).toThrow(WRAPPED);
    });

    it('should refuse its own result', () => {
      expect(() => tryFn(tryFn(thrower))).toThrow(WRAPPED);
    });

    it('should be refused by tryWrap', () => {
      expect(() => tryWrap(tryFn(thrower), {})).toThrow(
        `[TryError]: tryWrap cannot wrap an object that is already wrapped, or one that inherits from a wrapper.`,
      );
    });

    it('should refuse a function that declares try', () => {
      expect(() => tryFn(Object.assign(function f() {}, { try: 1 }))).toThrow(
        RESERVED,
      );
    });
  });

  /**
   * Each write gets a function of its own. Before the traps existed, a write
   * of `try` landed on the function behind the wrapper, and a shared one would
   * carry it into every later test.
   */
  describe('writes through the wrapper', () => {
    const fresh = () => {
      const fn = function target(): void {};

      return { fn, wrapped: tryFn(fn) };
    };

    it('should refuse assigning try', () => {
      const { wrapped } = fresh();

      expect(() => {
        (wrapped as any).try = 1;
      }).toThrow(WRITE);
    });

    it('should refuse defining try', () => {
      const { wrapped } = fresh();

      expect(() => Object.defineProperty(wrapped, 'try', { value: 1 })).toThrow(
        WRITE,
      );
    });

    /**
     * `set` refuses by identity, so this write is forwarded with the outer
     * proxy as its receiver. It still has to land somewhere, and defining it
     * on the outer proxy reaches the wrapper's `defineProperty`.
     */
    it('should refuse assigning try through a proxy standing in front', () => {
      const { fn, wrapped } = fresh();
      const front = new Proxy(wrapped, {});

      expect(() => {
        (front as any).try = 1;
      }).toThrow(WRITE);
      expect('try' in fn).toBe(false);
    });

    it('should forward any other write to the function', () => {
      const { fn, wrapped } = fresh();

      (wrapped as any).label = 'x';

      expect((fn as any).label).toBe('x');
    });

    it('should forward any other definition to the function', () => {
      const { fn, wrapped } = fresh();

      Object.defineProperty(wrapped, 'label', { value: 'x' });

      expect((fn as any).label).toBe('x');
    });

    it('should let an inheriting object assign its own try', () => {
      const { fn, wrapped } = fresh();
      const child = Object.create(wrapped);

      child.try = 1;

      expect(child.try).toBe(1);
      expect('try' in fn).toBe(false);
    });
  });
});
