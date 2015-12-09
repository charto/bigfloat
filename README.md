bigfloat
===

[![npm version](https://img.shields.io/npm/v/bigfloat.svg)](https://www.npmjs.com/package/bigfloat)

`bigfloat` is a fast arbitrary precision math library optimized for computational geometry and geoinformatics.
It provides base 2 floating point:

- conversion from JavaScript number type `x = new BigFloat(123.456)`
- addition `x.add(y)`
- subtraction `x.sub(y)`
- multiplication `x.mul(y)`
- comparison `x.deltaFrom(y)` alias `x.cmp(y)`
- conversion to string in base 2, 10 or 16 `x.toString(10)`

without ever losing any significant bits. Numbers are immutable in the above operations, so they return a new BigFloat.
For efficiency, the following methods instead destructuvely change the value:

- `x.truncate(limbs)` rounds the fractional digits towards zero, to `limbs * 32` bits.
- `x.round(digits)` rounds approximately to `digits` decimal places (to enough limbs to hold them).

Speed
---

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

BigFloat = require('bigfloat').BigFloat;
console.log(new BigFloat(x).add(1).sub(x).toString()); // Prints 1
```

Internals
---

Numbers are represented in 32-bit limbs (digits in base 2^32) somewhat like in the [GMP](https://gmplib.org/manual/Float-Internals.html) library. The least significant limb is stored first, because basic algorithms for arithmetic operations progress from the least to most significant digit while propagating carry. If carry causes the output to grow, adding a new limb at the end of the array is faster than adding it in the beginning.

`bigfloat` is optimized for exponents relatively close to zero, so the location of the decimal point is always present in the limb array, even if that introduces otherwise insignificant leading or trailing zero digits.

License
===

[The MIT License](https://raw.githubusercontent.com/charto/bigfloat/master/LICENSE)

Copyright (c) 2015 BusFaster Ltd
