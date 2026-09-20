import { Catch, Try, TryCatch, type TryCatchExtension, type TryError } from '../src';

describe('Catch', () => {
  it('should throw an error when attempting to catch a property', () => {
    // rejected as the class is defined, not on the first construction
    expect(() => {
      @TryCatch<Test>()
      class Test {
        // @ts-expect-error
        @Catch<Test>()
        failure = 'this will throw an error';
      }

      return Test;
    }).toThrow(
      `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
    );
  });

  describe('always catches', () => {
    it('should catch on a direct call, unlike @Try', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>()
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Boom().boom()).toBeNull();
    });

    it('should catch on a direct call to an accessor', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>()
        get boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Boom().boom).toBeNull();
    });

    it('should still catch through the .try map', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>()
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Boom().try.boom()).toBeNull();
    });

    it('should honour returnOnError on a direct call', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>({ returnOnError: 'fallback' })
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Boom().boom()).toBe('fallback');
    });

    it('should leave a member that does not throw alone', () => {
      interface Fine extends TryCatchExtension<Fine, 'fine'> {}

      @TryCatch<Fine>()
      class Fine {
        constructor(readonly name = 'NAMED') {}

        @Catch<Fine>()
        fine(suffix: string): string {
          return `${this.name}${suffix}`;
        }
      }

      expect(new Fine().fine('!')).toBe('NAMED!');
    });
  });

  describe('receiver', () => {
    it('should run a direct call against the calling instance', () => {
      interface Probe extends TryCatchExtension<Probe, 'ident'> {}

      @TryCatch<Probe>()
      class Probe {
        constructor(readonly name: string) {}

        @Catch<Probe>()
        ident(): string {
          return this.name;
        }
      }

      expect(new Probe('AAA').ident()).toBe('AAA');
      expect(new Probe('BBB').ident()).toBe('BBB');
    });

    it('should forward arguments as separate parameters on a direct call', () => {
      interface Adder extends TryCatchExtension<Adder, 'add'> {}

      @TryCatch<Adder>()
      class Adder {
        @Catch<Adder>()
        add(a: number, b: number): number {
          return a + b;
        }
      }

      expect(new Adder().add(1, 2)).toBe(3);
    });
  });

  describe('inheritance', () => {
    it('should catch on the base class even when a subclass is built first', () => {
      interface Base extends TryCatchExtension<Base, 'boom'> {}

      @TryCatch<Base>()
      class Base {
        @Catch<Base>()
        boom(): string {
          throw new Error('boom');
        }
      }

      class Sub extends Base {}

      // the wrapper belongs on the prototype that declared the member. Built
      // against the constructed instance's prototype instead, this lands on
      // Sub and leaves Base throwing.
      expect(new Sub().boom()).toBeNull();
      expect(new Base().boom()).toBeNull();
    });

    it('should leave a subclass override in place', () => {
      interface Base extends TryCatchExtension<Base, 'boom'> {}

      @TryCatch<Base>()
      class Base {
        @Catch<Base>()
        boom(): string {
          throw new Error('boom');
        }
      }

      class Sub extends Base {
        boom(): string {
          return 'override';
        }
      }

      expect(new Sub().boom()).toBe('override');
      expect(new Base().boom()).toBeNull();
    });
  });

  describe('options parity between the two call paths', () => {
    it('should apply class-wide runOnError to a direct call as well as .try', () => {
      const seen: string[] = [];

      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>({
        runOnError: (error: TryError) => {
          seen.push(error.property);

          return 'handled';
        },
      })
      class Boom {
        @Catch<Boom>()
        boom(): string {
          throw new Error('boom');
        }
      }

      const boom = new Boom();

      // the class decorator runs *after* the member decorator, so a catcher
      // built at decoration time cannot see these options at all.
      expect(boom.boom()).toBe('handled');
      expect(boom.try.boom()).toBe('handled');
      expect(seen).toEqual(['boom', 'boom']);
    });

    it('should run the error handler exactly once per direct call', () => {
      const runOnError = jest.fn(() => 'handled');

      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>({ runOnError })
        boom(): string {
          throw new Error('boom');
        }
      }

      // a decorator that both installs a wrapper and re-registers the mutated
      // descriptor would wrap twice, and the handler would fire twice.
      expect(new Boom().boom()).toBe('handled');
      expect(runOnError).toHaveBeenCalledTimes(1);
    });
  });
  describe('registration happens when the class is defined', () => {
    it('should catch before the class is ever instantiated', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>()
        boom(): string {
          throw new Error('boom');
        }
      }

      // no `new Boom()` first: a class nobody has constructed yet still catches
      expect(Boom.prototype.boom()).toBeNull();
    });

    it('should catch through a reference captured before the first instance', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        @Catch<Boom>()
        boom(): string {
          throw new Error('boom');
        }
      }

      // frameworks grab the unbound member at registration time
      const handler = Boom.prototype.boom;

      new Boom();

      expect(handler.call(new Boom())).toBeNull();
    });

    it('should catch a member called from the constructor of the first instance', () => {
      interface Boom extends TryCatchExtension<Boom, 'boom'> {}

      @TryCatch<Boom>()
      class Boom {
        readonly result: string;

        constructor() {
          this.result = this.boom();
        }

        @Catch<Boom>()
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Boom().result).toBeNull();
    });

    it('should reject a member claimed by two decorators', () => {
      // both entries would otherwise register, and the second would build its
      // catcher from the descriptor the first had already rewritten
      expect(() => {
        interface Boom extends TryCatchExtension<Boom, 'boom'> {}

        @TryCatch<Boom>()
        class Boom {
          @Try<Boom>()
          @Catch<Boom>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Boom;
      }).toThrow(
        `[TryError]: Only one of @Try or @Catch can be applied to a member. Property 'boom' is decorated more than once`,
      );
    });

    it('should reject the same member however the decorators are ordered', () => {
      expect(() => {
        interface Boom extends TryCatchExtension<Boom, 'boom'> {}

        @TryCatch<Boom>()
        class Boom {
          @Catch<Boom>()
          @Try<Boom>()
          boom(): string {
            throw new Error('boom');
          }
        }

        return Boom;
      }).toThrow(`Property 'boom' is decorated more than once`);
    });
  });

  describe('the wrapper it installs', () => {
    it('should keep the name and arity of the member it wraps', () => {
      interface Sum extends TryCatchExtension<Sum, 'add'> {}

      @TryCatch<Sum>()
      class Sum {
        @Catch<Sum>()
        add(a: number, b: number): number {
          return a + b;
        }
      }

      new Sum();

      expect(Sum.prototype.add.name).toBe('add');
      expect(Sum.prototype.add).toHaveLength(2);
    });
  });

  /**
   * Pinned deliberately: @Catch is the always-catching member of a class that
   * has a `.try` map, and the class decorator is what builds the manager that
   * installs the catcher. Without it the member is left exactly as declared.
   *
   * Catching on its own would leave @Catch indistinguishable from @CatchError,
   * which is the decorator for a member that wants no class registry at all.
   */
  describe('without @TryCatch on the class', () => {
    it('should leave a method throwing', () => {
      class Bare {
        @Catch<Bare>()
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(() => new Bare().boom()).toThrow('boom');
    });

    it('should leave an accessor throwing', () => {
      class Bare {
        @Catch<Bare>()
        get boom(): string {
          throw new Error('boom');
        }
      }

      expect(() => new Bare().boom).toThrow('boom');
    });
  });
});
