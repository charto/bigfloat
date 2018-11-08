# bigfloat

[![build status](https://travis-ci.org/charto/bigfloat.svg?branch=master)](http://travis-ci.org/charto/bigfloat)
[![npm version](https://img.shields.io/npm/v/bigfloat.svg)](https://www.npmjs.com/package/bigfloat)
[![dependency status](https://david-dm.org/charto/bigfloat.svg)](https://david-dm.org/charto/bigfloat)
[![install size](https://packagephobia.now.sh/badge?p=bigfloat)](https://packagephobia.now.sh/result?p=bigfloat)
[![license](https://img.shields.io/npm/l/bigfloat.svg)](https://raw.githubusercontent.com/charto/bigfloat/master/LICENSE)

`bigfloat` is a fast arbitrary precision math library optimized for computational geometry and geoinformatics.
It provides binary floating point:

- conversion to / from the JavaScript number type, `x = new BigFloat32(123.456)` and `x.valueOf()`
- addition, `x.add(y)`
- subtraction, `x.sub(y)`
- multiplication, `x.mul(y)`
- comparison, `x.deltaFrom(y)` alias `x.cmp(y)`
- string output in even bases 2-36, `x.toString(10)`
- string parsing in bases 2-36, `x = new BigFloat32('abc.def', 16)`

without ever losing any significant bits. Numbers are immutable in the above operations, so they return a new BigFloat.
For efficiency, the following methods instead destructively change the value:

- `x.truncate(limbs)` rounds the fractional digits towards zero, to `limbs * 32` or `limbs * 53` bits.
- `x.round(digits)` rounds approximately to `digits` decimal places (to enough limbs to hold them).

Division is deliberately unsupported, because its result is generally inexact.
Please multiply by the reciprocal or use rational numbers instead.
Note that floating point values in numerators and denominators are perfectly cromulent.
If you need square roots or transcendental functions, use some other library.

There are two versions of the class, `BigFloat32` and `BigFloat53` with the same API but completely different internals as follows:

**BigFloat32**

- Arbitrarily long sequence of bits split into 32-bit integers ("limbs", effectively digits in base `2 ** 32`),
  somewhat like in the [GMP](https://gmplib.org/manual/Float-Internals.html) library.
- The decimal point is a position between limbs, splitting the list of limbs into integer and fractional halves.
- Dense representation: all bits between the most and least significant are stored.
  - Optimized for exponents relatively close to zero, so the location of the decimal point is always present in the limb array,
    even if that introduces otherwise insignificant leading or trailing zero limbs.
- Precision is only limited by available memory.
- Uses integer math for best portability.
- Faster for operations between two arbitrary precision `BigFloat32` objects, slower for converting to / from JavaScript numbers.

**BigFloat53**

- Floating point expansion consisting of an unevaluated sum of components
  (JavaScript floating point numbers) ordered by increasing magnitude.
- Multiple representations exist for each number, depending on how bits are split between components
  (this is transparent: they still compare as equal).
- Each component can hold 1-53 bits of significand.
- Sparse representation: components consisting entirely of zeroes are not stored.
- Precision is limited by exponents representable in IEEE 754.
  - Binary digits at positions less significant than `2 ** -1074` (smallest double precision denormal) will disappear.
  - Numbers rounding to `2 ** 1024` or greater will overflow **spectacularly**.
- Uses error free transformations (see JR Shewchuk.
  [*Adaptive Precision Floating-Point Arithmetic and Fast Robust Geometric Predicates*](doc/robustr.pdf),
  1997).
  - Requires accurate rounding to nearest with ties to even as specified by EcmaScript 5.1 and up
    ([section 8.5](https://www.ecma-international.org/ecma-262/5.1/#sec-8.5)).
- Faster for operations between arbitrary precision `BigFloat53` objects and JavaScript numbers, slower for operations between two arbitrary precision objects.

In both versions the least significant limb / component is stored first,
because basic algorithms for arithmetic operations progress from the least to most significant digit while propagating carry.
If carry causes the output to grow, adding a new limb at the end of the array is faster than adding it in the beginning.

TL;DR: Use `BigFloat32` for long operations between arbitrary precision floats, portability and to avoid under / overflow.
Use `BigFloat53` for short calculations with many ordinary JavaScript numbers as inputs.

You may want to test with both to compare their speed and see if you run into overflow
or any floating point portability issues on mobile platforms.

## Optimization

In any longer iterated calculations involving multiplication, `truncate` should be called regularly because otherwise significant bits will keep accumulating.
For example, squaring a number doubles the number of bits at every step, easily turning an algorithm with linear complexity into a quadratic one
(both in speed and space).

To avoid surprises, the basic operations allocate new objects for storing results. A second parameter can be given,
with a result `BigFloat` object of the same type (32 or 53). Its contents will be destructively overwritten with the result,
to save a memory allocation. This avoids garbage collection related slowdowns in longer calculations.

Some care is needed in re-using temporary variables, because inputs cannot be simultaneously used as results:

```TypeScript
x.add(y, w).sub(z, w)
```

fails because in the subtraction, `w` is both the subtrahend and the difference.

Existing objects can also be re-initialized with:

- zero, `x.setZero()`
- new value from a JavaScript number, `x.setValue(123.456)`

Additionally, `BigFloat53` objects support initialization from results of operations between two JavaScript numbers:

- sum, `x.setSum(12.34, 56.78)`
- product, `x.setProduct(12.34, 56.78)`

These use very fast double double arithmetic (error free transformations).

## Speed

It's fast, see the [Mandelbrot benchmark](http://charto.github.io/bigfloat/). Here's some example results:

Native JavaScript IEEE 754:  
████████████████████████████████ // ██ 80000 frames per minute

`bigfloat`:  
████████████████████████████ 141 frames per minute

[bignumber.js](https://github.com/MikeMcl/bignumber.js):  
██████████ 48 frames per minute

[big.js](https://github.com/MikeMcl/big.js):  
███████ 35 frames per minute

Getting started
---

```bash
git clone https://github.com/charto/bigfloat.git node_modules/bigfloat
cd node_modules/bigfloat && npm install
cd ../..
node
```

OR

```bash
npm install bigfloat
node
```

THEN

```js
x = Math.pow(2, 53);
console.log(x + 1 - x); // Prints 0

BigFloat32 = require('bigfloat').BigFloat32;
console.log(new BigFloat32(x).add(1).sub(x).toString()); // Prints 1
```

# License

[The MIT License](https://raw.githubusercontent.com/charto/bigfloat/master/LICENSE)

Copyright (c) 2015- BusFaster Ltd

The paper `doc/robustr.pdf` is copyright JR Shewchuk and licenced as detailed inside under "About this Report".
