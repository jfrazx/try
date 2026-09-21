import { Catch, CatchError, Try, TryCatch, type TryCatchExtension } from '../src';

/**
 * Every contradiction the library rejects, gathered so the guarantee the README
 * makes — one catching decorator per member, and nothing decorated that cannot
 * be wrapped — is pinned in one place.
 *
 * All of these are rejected as the class is defined. A contradiction that waits
 * for the first construction is one a test suite can miss entirely.
 */
describe('rejected declarations', () => {
  describe('a member decorated twice', () => {
    it('should reject @Try alongside @Catch', () => {
      expect(() => {
        @TryCatch<Test>()
        class Test {
          @Try<Test>()
          @Catch<Test>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: Only one of @Try or @Catch can be applied to a member. Property 'boom' is decorated more than once`,
      );
    });

    /**
     * Two @CatchError never reach the try map at all, so the check that catches
     * a repeated @Try or @Catch cannot see them. The inner one answers every
     * call, leaving the outer `returnOnError` and `runOnError` unreachable.
     */
    it('should reject a second @CatchError', () => {
      const ran: string[] = [];

      expect(() => {
        class Test {
          @CatchError<Test>({
            returnOnError: 'outer',
            runOnError: () => ran.push('outer'),
          })
          @CatchError<Test>({ returnOnError: 'inner' })
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: Only one @CatchError can be applied to a member. Property 'boom' is decorated more than once`,
      );

      expect(ran).toEqual([]);
    });

    /**
     * @CatchError installs its wrapper itself and never registers, so it cannot
     * be found in the try map the way a second @Try or @Catch can. Left
     * unchecked the outer decorator wraps the inner one's wrapper: the inner
     * catcher answers first, so its `returnOnError` wins and the outer
     * `runOnError` never runs.
     */
    it('should reject @Catch stacked over @CatchError', () => {
      const ran: string[] = [];

      expect(() => {
        @TryCatch<Test>()
        class Test {
          @Catch<Test>({
            returnOnError: 'outer',
            runOnError: () => ran.push('outer'),
          })
          @CatchError<Test>({ returnOnError: 'inner' })
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property 'boom' is already caught by @CatchError, which needs no class decorator`,
      );

      expect(ran).toEqual([]);
    });

    it('should reject @CatchError stacked over @Catch', () => {
      expect(() => {
        @TryCatch<Test>()
        class Test {
          @CatchError<Test>({ returnOnError: 'inner' })
          @Catch<Test>({ returnOnError: 'outer' })
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property 'boom' is already caught by @CatchError, which needs no class decorator`,
      );
    });

    /**
     * @Try promises a direct call still throws. Stacking @CatchError under it
     * catches that call, which is the opposite of what the member declares.
     */
    it('should reject @Try stacked over @CatchError', () => {
      expect(() => {
        @TryCatch<Test>()
        class Test {
          @Try<Test>()
          @CatchError<Test>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property 'boom' is already caught by @CatchError, which needs no class decorator`,
      );
    });
  });

  /**
   * A catcher's wrapper is the member from the moment it is installed, and an
   * unrelated decorator above it is handed that wrapper and free to replace it
   * with one of its own. Anything recorded on the wrapper goes with it, so the
   * claim is kept against the prototype: the member's name there is the same
   * however many decorators stand in between.
   *
   * Left to the wrapper, every one of these declarations is accepted and the
   * inner catcher answers every call — the outer decorator's `returnOnError`
   * and `runOnError` are unreachable, with nothing said.
   */
  describe('a decorator standing between two of ours', () => {
    const relay = (
      _target: object,
      _property: string | symbol,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor => {
      const wrapped = descriptor.value;

      return {
        ...descriptor,
        value: function (this: unknown, ...args: unknown[]) {
          return wrapped.apply(this, args);
        },
      };
    };

    it('should reject @Catch above it, over @CatchError', () => {
      const ran: string[] = [];

      expect(() => {
        @TryCatch<Test>()
        class Test {
          @Catch<Test>({
            returnOnError: 'outer',
            runOnError: () => void ran.push('outer'),
          })
          @relay
          @CatchError<Test>({ returnOnError: 'inner' })
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property 'boom' is already caught by @CatchError, which needs no class decorator`,
      );

      expect(ran).toEqual([]);
    });

    it('should reject @Try above it, over @CatchError', () => {
      expect(() => {
        @TryCatch<Test>()
        class Test {
          @Try<Test>()
          @relay
          @CatchError<Test>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property 'boom' is already caught by @CatchError, which needs no class decorator`,
      );
    });

    it('should reject a second @CatchError above it', () => {
      const ran: string[] = [];

      expect(() => {
        class Test {
          @CatchError<Test>({
            returnOnError: 'outer',
            runOnError: () => void ran.push('outer'),
          })
          @relay
          @CatchError<Test>({ returnOnError: 'inner' })
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: Only one @CatchError can be applied to a member. Property 'boom' is decorated more than once`,
      );

      expect(ran).toEqual([]);
    });

    it('should leave a lone @CatchError beneath it working', () => {
      class Test {
        @relay
        @CatchError<Test>({ returnOnError: 'caught' })
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Test().boom()).toBe('caught');
    });
  });

  /**
   * `@Catch` replaces the member so that a direct call is caught, and a
   * decorator applied above it can seal the descriptor and make that
   * impossible. Redefining it anyway throws a bare TypeError naming only the
   * property, while leaving the member alone would demote `@Catch` to `@Try`
   * with nothing said.
   */
  describe('a member another decorator sealed', () => {
    const seal = (
      _target: object,
      _property: string | symbol,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor => ({ ...descriptor, configurable: false });

    it('should reject @Catch beneath it, naming the member', () => {
      expect(() => {
        @TryCatch<Test>()
        class Test {
          @seal
          @Catch<Test>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @Catch has to replace the member it catches, and property 'boom' cannot be redefined. A decorator applied above it returned a non-configurable descriptor`,
      );
    });

    it('should accept @Try beneath it, which replaces nothing', () => {
      interface Test extends TryCatchExtension<Test, 'boom'> {}

      @TryCatch<Test>()
      class Test {
        @seal
        @Try<Test>()
        boom(): string {
          throw new Error('boom');
        }
      }

      const test = new Test();

      expect(() => test.boom()).toThrow('boom');
      expect(test.try.boom()).toBeNull();
    });
  });

  /**
   * A setter has a descriptor, so the rule that rejects plain properties does
   * not claim it, and neither accessor nor method rule can wrap it. Without a
   * terminal rule it falls off the end of the chain as a TypeError naming an
   * internal property, which says nothing about the member that caused it.
   */
  describe('a setter with no getter', () => {
    const message = `[TryError]: Only methods and getters can be captured. Property 'thing' has no value or getter to wrap`;

    it('should reject it under @CatchError', () => {
      expect(() => {
        class Test {
          @CatchError<Test>()
          set thing(_value: string) {
            throw new Error('nope');
          }
        }

        return Test;
      }).toThrow(message);
    });

    it('should reject it under @Catch', () => {
      expect(() => {
        @TryCatch<Test>()
        class Test {
          @Catch<Test>()
          set thing(_value: string) {
            throw new Error('nope');
          }
        }

        return Test;
      }).toThrow(message);
    });

    it('should accept a getter that also has a setter, and keep the setter', () => {
      const written: string[] = [];

      @TryCatch<Test>()
      class Test {
        @Catch<Test>()
        get thing(): string {
          throw new Error('nope');
        }

        set thing(value: string) {
          written.push(value);
        }
      }

      const test = new Test();

      test.thing = 'written';

      expect(test.thing).toBeNull();
      expect(written).toEqual(['written']);
    });
  });

  /**
   * For a static member the decorator is handed the constructor rather than the
   * prototype, so `target.constructor` is the global `Function` — a key no
   * class decorator reads. The member was filed where nothing looks: it never
   * caught, never appeared on `.try`, and said nothing about why.
   *
   * The member decorator rejects it on its own, so these need no `@TryCatch()`
   * to demonstrate: by the time the class decorator would run, the declaration
   * has already failed.
   */
  describe('a static member', () => {
    it('should reject @Catch', () => {
      expect(() => {
        class Test {
          @Catch<Test>()
          static boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @Catch cannot decorate a static member. Property 'boom' is static, and the registry @TryCatch builds covers instances — use @CatchError, which needs no class decorator`,
      );
    });

    it('should reject @Try', () => {
      expect(() => {
        class Test {
          @Try<Test>()
          static boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @Try cannot decorate a static member. Property 'boom' is static, and the registry @TryCatch builds covers instances — use @CatchError, which needs no class decorator`,
      );
    });

    it('should leave @CatchError working, as it needs no registry', () => {
      class Test {
        @CatchError<Test>()
        static boom(): string {
          throw new Error('boom');
        }
      }

      expect(Test.boom()).toBeNull();
    });
  });

  /**
   * The second @TryCatch is handed the first one's proxy, which is a different
   * key from the class the members registered under. Its manager reads an empty
   * queue, and since it is the outer proxy every instance gets, `.try` answers
   * for no member at all.
   */
  describe('a class decorated twice', () => {
    it('should reject a second @TryCatch', () => {
      expect(() => {
        interface Test extends TryCatchExtension<Test, 'boom'> {}

        @TryCatch<Test>()
        @TryCatch<Test>()
        class Test {
          @Try<Test>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Test;
      }).toThrow(
        `[TryError]: @TryCatch can only be applied once to a class. 'Test' is decorated more than once`,
      );
    });

    /**
     * Stacked decorators hand the second `@TryCatch` the first one's proxy, but
     * calling the factory's result directly hands it the class — a different
     * object, and the one the members registered under. Accepted, the second
     * manager reads the queue the first already emptied and replaces it, so
     * every instance handed out before loses `.try` entirely.
     */
    it('should reject @TryCatch applied to the same class a second time', () => {
      interface Test extends TryCatchExtension<Test, 'boom'> {}

      class Test {
        @Try<Test>()
        boom(): string {
          throw new Error('boom');
        }
      }

      const wrapped = TryCatch<Test>()(Test);

      expect(() => TryCatch<Test>()(Test)).toThrow(
        `[TryError]: @TryCatch can only be applied once to a class. 'Test' is decorated more than once`,
      );

      expect(new wrapped().try.boom()).toBeNull();
    });

    it('should leave a subclass of a decorated class free to decorate', () => {
      interface Base extends TryCatchExtension<Base, 'boom'> {}

      @TryCatch<Base>()
      class Base {
        @Catch<Base>()
        boom(): string {
          throw new Error('boom');
        }
      }

      @TryCatch<Sub>()
      class Sub extends Base {
        @Catch<Sub>()
        crash(): string {
          throw new Error('crash');
        }
      }

      const sub = new Sub();

      expect(sub.crash()).toBeNull();
      expect((sub as any).try.crash()).toBeNull();
    });
  });

  /**
   * Registering a member changes the class: one that always catches replaces
   * what the prototype holds. A member further down the list can still be
   * rejected, so nothing is committed until every member has passed.
   *
   * Applying the decorator by hand is what makes this reachable. Written as a
   * decorator the throw aborts the module, and the class goes with it — called
   * as a function, the caller still holds the class the library rejected.
   */
  describe('a class rejected partway through registration', () => {
    interface Rejected {
      first(): string;
      second(): string;
    }

    const build = (): new () => Rejected => {
      class Test {
        @Catch<Test>({ returnOnError: 'caught' })
        first(): string {
          throw new Error('first');
        }

        @Try<Test>()
        @Catch<Test>()
        second(): string {
          throw new Error('second');
        }
      }

      return Test;
    };

    const message =
      "[TryError]: Only one of @Try or @Catch can be applied to a member. Property 'second' is decorated more than once";

    it('should leave the members it had already accepted alone', () => {
      const Test = build();
      const declared = Object.getOwnPropertyDescriptor(Test.prototype, 'first');

      expect(() => TryCatch<Rejected>()(Test)).toThrow(message);

      expect(Object.getOwnPropertyDescriptor(Test.prototype, 'first')).toEqual(
        declared,
      );
      expect(() => new Test().first()).toThrow('first');
    });

    it('should not wrap a member twice when the class is offered again', () => {
      const Test = build();
      const declared = Object.getOwnPropertyDescriptor(Test.prototype, 'first');

      expect(() => TryCatch<Rejected>()(Test)).toThrow(message);
      expect(() => TryCatch<Rejected>()(Test)).toThrow(message);

      expect(Object.getOwnPropertyDescriptor(Test.prototype, 'first')).toEqual(
        declared,
      );
    });
  });
});
