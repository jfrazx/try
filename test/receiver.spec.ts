import { TryCatch, Try, CatchError, type TryCatchExtension } from '../src';

type ProbeProps = Pick<Probe, 'ident' | 'label'>;

interface Probe extends TryCatchExtension<Probe, keyof ProbeProps> {}

@TryCatch<Probe>()
class Probe {
  constructor(readonly name: string) {}

  @Try<Probe>()
  ident(): string {
    return this.name;
  }

  @Try<Probe>()
  get label(): string {
    return `L:${this.name}`;
  }
}

describe('catcher receiver', () => {
  describe('.try runs against the calling instance', () => {
    it('should not reuse the first constructed instance for a method', () => {
      const a = new Probe('AAA');
      const b = new Probe('BBB');

      expect(a.try.ident()).toBe('AAA');
      expect(b.try.ident()).toBe('BBB');
    });

    it('should not reuse the first constructed instance for an accessor', () => {
      const a = new Probe('AAA');
      const b = new Probe('BBB');

      expect(a.try.label).toBe('L:AAA');
      expect(b.try.label).toBe('L:BBB');
    });

    it('should agree with the direct call path', () => {
      const a = new Probe('AAA');
      const b = new Probe('BBB');

      expect(b.try.ident()).toBe(b.ident());
      expect(a.try.label).toBe(a.label);
    });
  });

  describe('@CatchError runs against the instance, not the prototype', () => {
    it('should read instance state from a method', () => {
      class Loader {
        name = 'INSTANCE';

        @CatchError()
        who(): string {
          return this.name;
        }
      }

      expect(new Loader().who()).toBe('INSTANCE');
    });

    it('should read instance state from an accessor', () => {
      class Loader {
        name = 'INSTANCE';

        @CatchError()
        get who(): string {
          return this.name;
        }
      }

      expect(new Loader().who).toBe('INSTANCE');
    });

    it('should keep each instance distinct', () => {
      class Loader {
        constructor(readonly name: string) {}

        @CatchError()
        who(): string {
          return this.name;
        }
      }

      expect(new Loader('A').who()).toBe('A');
      expect(new Loader('B').who()).toBe('B');
    });

    it('should still catch when the member throws', () => {
      class Loader {
        name = 'INSTANCE';

        @CatchError()
        who(): string {
          throw new Error(this.name);
        }
      }

      expect(new Loader().who()).toBeNull();
    });
  });
  describe('the .try map is not pinned to one receiver', () => {
    it('should not let a derived object capture the map of its prototype', () => {
      const a = new Probe('AAA');
      const derived: Probe = Object.create(a);

      Object.defineProperty(derived, 'name', { value: 'DERIVED' });

      // reading .try through the derived object first must not poison `a`
      expect(derived.try.ident()).toBe('DERIVED');
      expect(a.try.ident()).toBe('AAA');
    });

    it('should hand back the same map for repeated reads on one instance', () => {
      const a = new Probe('AAA');

      expect(a.try).toBe(a.try);
    });
  });
});
