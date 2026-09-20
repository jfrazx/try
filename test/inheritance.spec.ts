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

/**
 * A class standing between two decorated ones need not be decorated itself.
 * Its members are inherited like any other, so the lookup for a decorated
 * ancestor walks the chain rather than stopping at the class immediately above.
 */
describe('a decorated subclass across an undecorated class', () => {
  interface Base extends TryCatchExtension<Base, 'tried' | 'caught' | 'shadowed'> {}

  @TryCatch<Base>()
  class Base {
    @Try<Base>()
    tried(): string {
      throw new Error('tried');
    }

    @Catch<Base>({ returnOnError: 'base caught' })
    caught(): string {
      throw new Error('caught');
    }

    @Try<Base>({ returnOnError: 'base shadowed' })
    shadowed(): string {
      throw new Error('base shadowed');
    }
  }

  class Middle extends Base {
    shadowed(): string {
      return 'middle shadowed';
    }
  }

  @TryCatch<Sub>()
  class Sub extends Middle {
    @Catch<Sub>({ returnOnError: 'sub own' })
    own(): string {
      throw new Error('own');
    }
  }

  const subject = () => new Sub() as Tryable<Sub, 'tried' | 'caught' | 'own'>;

  it("should reach the decorated ancestor's @Try member", () => {
    expect(subject().try.tried()).toBeNull();
  });

  it("should reach the decorated ancestor's @Catch member", () => {
    expect(subject().try.caught()).toBe('base caught');
  });

  it('should keep the subclass its own members', () => {
    expect(subject().try.own()).toBe('sub own');
  });

  /**
   * The undecorated class in the middle overrode the member, so it is no longer
   * the ancestor's. Inheriting the catcher anyway would leave `.try` running
   * the implementation that was replaced.
   */
  it('should not answer for a member the undecorated class overrode', () => {
    expect(() => (subject() as any).try.shadowed()).toThrow(
      "[TryError]: Property 'shadowed' does not exist in TryMap",
    );

    expect((subject() as any).shadowed()).toBe('middle shadowed');
  });
});

/**
 * Only the nearest decorated ancestor is adopted. That class performed this
 * same inheritance as it was defined, so its map already carries whatever it
 * took from further up the chain.
 */
describe('three decorated classes in a chain', () => {
  interface Top extends TryCatchExtension<Top, 'top'> {}

  @TryCatch<Top>()
  class Top {
    @Try<Top>({ returnOnError: 'top' })
    top(): string {
      throw new Error('top');
    }
  }

  @TryCatch<Middle>()
  class Middle extends Top {
    @Try<Middle>({ returnOnError: 'middle' })
    middle(): string {
      throw new Error('middle');
    }
  }

  @TryCatch<Bottom>()
  class Bottom extends Middle {
    @Try<Bottom>({ returnOnError: 'bottom' })
    bottom(): string {
      throw new Error('bottom');
    }
  }

  it('should reach every ancestor from the bottom', () => {
    const bottom = new Bottom() as Tryable<Bottom, 'top' | 'middle' | 'bottom'>;

    expect(bottom.try.top()).toBe('top');
    expect(bottom.try.middle()).toBe('middle');
    expect(bottom.try.bottom()).toBe('bottom');
  });

  it('should leave each ancestor answering for only what it knows', () => {
    const middle = new Middle() as Tryable<Middle, 'top' | 'middle'>;

    expect(middle.try.top()).toBe('top');
    expect(middle.try.middle()).toBe('middle');
    expect(() => (middle as any).try.bottom()).toThrow(
      "[TryError]: Property 'bottom' does not exist in TryMap",
    );
  });
});
