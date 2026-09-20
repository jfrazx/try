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
});
