import { Catch, Try, TryCatch, type Tryable, type TryCatchExtension } from '../src';

/**
 * A manager is built per class from that class's own decorators, so a subclass
 * starts out knowing only what it declares. Everything the base declared is
 * still on the instance, reached through the prototype chain like any other
 * member — these pin `.try` to saying the same thing.
 */
describe('a decorated subclass of a decorated class', () => {
  const ran: string[] = [];

  interface Base extends TryCatchExtension<Base, 'tried' | 'caught' | 'replaced'> {}

  @TryCatch<Base>({ runOnError: () => void ran.push('base options') })
  class Base {
    @Try<Base>()
    tried(): string {
      throw new Error('tried');
    }

    @Catch<Base>({ returnOnError: 'base caught' })
    caught(): string {
      throw new Error('caught');
    }

    @Try<Base>({ returnOnError: 'base replaced' })
    replaced(): string {
      throw new Error('base replaced');
    }
  }

  /**
   * The subclass takes its `.try` from {@link Tryable} rather than merging an
   * interface of its own. A merged interface would inherit the base's `try`
   * and declare a second one, which TypeScript refuses as two non-identical
   * properties of the same name.
   */
  @TryCatch<Sub>()
  class Sub extends Base {
    @Catch<Sub>({ returnOnError: 'sub own' })
    own(): string {
      throw new Error('own');
    }

    replaced(): string {
      throw new Error('sub replaced');
    }
  }

  beforeEach(() => {
    ran.length = 0;
  });

  const subject = () => new Sub() as Tryable<Sub, 'tried' | 'caught' | 'own'>;

  it("should reach a base class's @Try member through the subclass", () => {
    expect(subject().try.tried()).toBeNull();
  });

  it("should reach a base class's @Catch member through the subclass", () => {
    const sub = subject();

    expect(sub.try.caught()).toBe('base caught');
    expect(sub.caught()).toBe('base caught');
  });

  it('should keep the subclass its own members', () => {
    expect(subject().try.own()).toBe('sub own');
  });

  /**
   * The member was declared under the base class's `@TryCatch` options, so
   * those are the options it keeps. Rebuilding the catcher for each subclass
   * would make an inherited member behave differently depending on who
   * extended it.
   */
  it("should resolve an inherited member against the base class's options", () => {
    subject().try.tried();

    expect(ran).toEqual(['base options']);
  });

  /**
   * An override carrying no decorator is not catchable, and adopting the base's
   * catcher for it would leave `.try` running the implementation the subclass
   * replaced while a direct call ran the replacement.
   */
  it('should not answer for a member the subclass overrode without decorating', () => {
    const sub = subject();

    expect(() => (sub.try as any).replaced()).toThrow(
      `[TryError]: Property 'replaced' does not exist in TryMap`,
    );
    expect(() => sub.replaced()).toThrow('sub replaced');
  });

  it('should still reject a member that was never decorated anywhere', () => {
    expect(() => (subject().try as any).nope()).toThrow(
      `[TryError]: Property 'nope' does not exist in TryMap`,
    );
  });

  it('should leave the base class untouched', () => {
    const base = new Base();

    expect(base.try.tried()).toBeNull();
    expect(base.try.replaced()).toBe('base replaced');
  });
});

/**
 * An override that declares its own intent gets its own catcher. The duplicate
 * check must not see the inherited entry, or a legitimate override would be
 * rejected as a member decorated twice.
 */
describe('a subclass overriding a decorated member', () => {
  interface Base extends TryCatchExtension<Base, 'boom'> {}

  @TryCatch<Base>()
  class Base {
    @Try<Base>({ returnOnError: 'base' })
    boom(): string {
      throw new Error('base boom');
    }
  }

  @TryCatch<Sub>()
  class Sub extends Base {
    @Try<Sub>({ returnOnError: 'sub' })
    boom(): string {
      throw new Error('sub boom');
    }
  }

  it('should accept the override', () => {
    expect((new Sub() as Tryable<Sub, 'boom'>).try.boom()).toBe('sub');
  });

  it('should leave the base class resolving to its own', () => {
    expect(new Base().try.boom()).toBe('base');
  });
});

/**
 * An undecorated subclass is constructed through the base's proxy, so it was
 * already served by the base's manager. Pinned here so the inheritance the
 * decorated case now performs is not mistaken for the only path that works.
 */
describe('an undecorated subclass of a decorated class', () => {
  interface Base extends TryCatchExtension<Base, 'boom'> {}

  @TryCatch<Base>()
  class Base {
    @Try<Base>()
    boom(): string {
      throw new Error('boom');
    }
  }

  class Sub extends Base {
    also(): string {
      return 'also';
    }
  }

  it('should still reach the base class members', () => {
    const sub = new Sub();

    expect(sub.try.boom()).toBeNull();
    expect(sub.also()).toBe('also');
  });
});
