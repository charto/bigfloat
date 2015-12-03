import {BigFloat} from '../dist/bigfloat';

function debug(dbl: number) {
	const big = new BigFloat(dbl);

	const b10a = BigFloat.doubleToString(dbl);
	const b10b = big.toString();
	const b16a = BigFloat.doubleToString(dbl, 16);
	const b16b = big.toString(16);

	if(b10a != b10b || b16a != b16b) {
		console.log('ERROR');

		const buf = new ArrayBuffer(8);
		const charView = new Uint8Array(buf);
		const doubleView = new Float64Array(buf);

		doubleView[0] = dbl;

		console.log('hex = ' + Array.prototype.map.call(charView, (x: number) => (x < 16 ? '0' : '') + x.toString(16)).join(''));
		console.log('exp = ' + (Math.log(Math.abs(dbl)) / Math.LN2));

		console.log(b10a);
		console.log(b10b);
		console.log(b16a);
		console.log(b16b);
	}
}


const buf = new ArrayBuffer(8);
const charView = new Uint8Array(buf);
const shortView = new Uint16Array(buf);
const doubleView = new Float64Array(buf);

let count = 0;
let exp = 0;

console.log('Fuzz-testing conversion number -> BigFloat -> string...');

for(let i = 0; i < 100000; ++i) {
	for(let j = 0; j < 4; ++j) {
		shortView[j] = ~~(Math.random() * 65536);
	}

	exp = (Math.random() * 64) - 2;

	// Set exponent.
	charView[7] = (charView[7] & 0x80) | ((exp + 1023) >> 4);
	charView[6] = (charView[6] & 0x0f) | ((exp + 1023) << 4);

	// Clear last 3 bits of mantissa.
	charView[0] &= 0xf8;

	debug(doubleView[0]);
}
