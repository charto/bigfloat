bigfloat
========

[![npm version](https://img.shields.io/npm/v/bigfloat.svg)](https://www.npmjs.com/package/bigfloat)

This library is under construction, the only features currently working are conversion from numbers and to strings.

`bigfloat` is a fast arbitrary precision math library optimized for computational geometry and geoinformatics.
It provides base 2 floating point:

- addition
- subtraction
- multiplication
- comparison
- conversion from JavaScript number type
- conversion to string in base 2, 10 or 16

without ever losing any significant bits.

Internally numbers are represented in 32-bit limbs somewhat like in the [GMP](https://gmplib.org/) library.

`bigfloat` is optimized for exponents relatively close to zero.

License
===

[The MIT License](https://raw.githubusercontent.com/charto/bigfloat/master/LICENSE)

Copyright (c) 2015 BusFaster Ltd
