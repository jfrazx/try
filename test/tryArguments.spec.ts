import { TryCatch, Try, type TryCatchExtension, type TryError } from '../src';

// captured module-side rather than on `this`: catchers run the original
// against the stored target, so instance state is not visible here (#33).
let received: unknown[] = [];

type CalculatorProps = Pick<Calculator, 'add' | 'record' | 'identity'>;

interface Calculator extends TryCatchExtension<Calculator, keyof CalculatorProps> {}

@TryCatch<Calculator>()
class Calculator {
  @Try()
  add(a: number, b: number): number {
    received = [a, b];

    return a + b;
  }

  @Try()
  record(...args: unknown[]): number {
    received = args;

    return args.length;
  }

  @Try()
  identity<V>(value: V): V {
    received = [value];

    return value;
  }
}

describe('Try arguments', () => {
  beforeEach(() => {
    received = [];
  });

  it('should bind arguments passed through .try to their own parameters', () => {
    const calculator = new Calculator();

    expect(calculator.try.add(1, 2)).toBe(3);
    expect(received).toEqual([1, 2]);
  });

  it('should not collapse arguments into a single array', () => {
    const calculator = new Calculator();

    // the regression this guards: prepareRun handed catchError the collected
    // rest parameter as one argument, so the method saw an arity of 1 and
    // received [[1, 2]] rather than [1, 2].
    expect(calculator.try.record(1, 2)).toBe(2);
    expect(received).toEqual([1, 2]);
  });

  it('should hand a lone argument over without wrapping it', () => {
    const calculator = new Calculator();
    const payload = { a: 'b' };

    // a single *string* argument survives the nested-array bug by accident,
    // because ['x'].toString() === 'x'. Reference identity does not coerce,
    // so this is the shape of single-argument call that actually proves it.
    expect(calculator.try.identity(payload)).toBe(payload);
    expect(received).toEqual([payload]);
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
});
