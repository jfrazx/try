import {
  TryCatch,
  Try,
  CatchError,
  type TryCatchExtension,
  type TryError,
} from '../src';

type CalculatorProps = Pick<Calculator, 'add' | 'record' | 'identity'>;

interface Calculator extends TryCatchExtension<Calculator, keyof CalculatorProps> {}

@TryCatch<Calculator>()
class Calculator {
  // recorded on the instance: what each member saw is only observable here
  // while the catcher runs the original against the calling object.
  received: unknown[] = [];

  @Try()
  add(a: number, b: number): number {
    this.received = [a, b];

    return a + b;
  }

  @Try()
  record(...args: unknown[]): number {
    this.received = args;

    return args.length;
  }

  @Try()
  identity<V>(value: V): V {
    this.received = [value];

    return value;
  }
}

describe('Try arguments', () => {
  it('should bind arguments passed through .try to their own parameters', () => {
    const calculator = new Calculator();

    expect(calculator.try.add(1, 2)).toBe(3);
    expect(calculator.received).toEqual([1, 2]);
  });

  it('should not collapse arguments into a single array', () => {
    const calculator = new Calculator();

    // the regression this guards: prepareRun handed catchError the collected
    // rest parameter as one argument, so the method saw an arity of 1 and
    // received [[1, 2]] rather than [1, 2].
    expect(calculator.try.record(1, 2)).toBe(2);
    expect(calculator.received).toEqual([1, 2]);
  });

  it('should hand a lone argument over without wrapping it', () => {
    const calculator = new Calculator();
    const payload = { a: 'b' };

    // a single *string* argument survives the nested-array bug by accident,
    // because ['x'].toString() === 'x'. Reference identity does not coerce,
    // so this is the shape of single-argument call that actually proves it.
    expect(calculator.try.identity(payload)).toBe(payload);
    expect(calculator.received).toEqual([payload]);
  });

  it('should report the arguments on TryError as they were passed', () => {
    let tryError: TryError | undefined;

    @TryCatch<Failing>()
    class Failing {
      @Try({ runOnError: (error: TryError) => void (tryError = error) })
      concat(first: string, second: string): string {
        throw new Error(`${first}${second}`);
      }
    }

    interface Failing extends TryCatchExtension<Failing, 'concat'> {}

    new Failing().try.concat('a', 'b');

    expect(tryError?.arguments).toEqual(['a', 'b']);
    expect(tryError?.error.message).toBe('ab');
  });

  it('should pass no arguments to a zero-argument member through .try', () => {
    let tryError: TryError | undefined;

    interface Empty extends TryCatchExtension<Empty, 'none'> {}

    @TryCatch<Empty>()
    class Empty {
      @Try({ runOnError: (error: TryError) => void (tryError = error) })
      none(): number {
        throw new Error('none');
      }
    }

    // never affected by the spreading defect, pinned so a future change to
    // prepareRun cannot silently start passing an empty array as one argument.
    new Empty().try.none();

    expect(tryError?.arguments).toEqual([]);
  });

  it('should forward arguments the same way through the @CatchError path', () => {
    let tryError: TryError | undefined;
    let seen: unknown[] = [];

    class Decorated {
      @CatchError()
      record(...args: unknown[]): number {
        seen = args;

        return args.length;
      }

      @CatchError({ runOnError: (error: TryError) => void (tryError = error) })
      concat(first: string, second: string): string {
        throw new Error(`${first}${second}`);
      }
    }

    const decorated = new Decorated();

    // @CatchError installs catchError as the descriptor value directly rather
    // than going through the .try map, so it never had the spreading defect.
    // Both paths now also run against the calling instance (#33), so this
    // pins where the two agree -- installation is the only difference left.
    expect(decorated.record(1, 2)).toBe(2);
    expect(seen).toEqual([1, 2]);

    decorated.concat('a', 'b');

    expect(tryError?.arguments).toEqual(['a', 'b']);
  });
});
