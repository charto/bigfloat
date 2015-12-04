import {BigFloat} from '../dist/bigfloat';
import * as childProcess from 'child_process';
import * as fs from 'fs';

const buf = new ArrayBuffer(8);
const charView = new Uint8Array(buf);
const shortView = new Uint16Array(buf);
const doubleView = new Float64Array(buf);

// var A = new BigFloat(0x27bc04b9253a9);

function randDouble() {
	for(let i = 0; i < 4; ++i) {
		shortView[i] = ~~(Math.random() * 65536);
	}

	exp = (Math.random() * 64) - 2;

	// Set exponent.
	charView[7] = (charView[7] & 0x80) | ((exp + 1023) >> 4);
	charView[6] = (charView[6] & 0x0f) | ((exp + 1023) << 4);

	// Clear last 3 bits of mantissa.
	charView[0] &= 0xf8;

	return(doubleView[0]);
}

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

let count = 0;
let exp = 0;

console.log('Fuzz-testing conversion number -> BigFloat -> string...');

for(let i = 0; i < 100000; ++i) {
	debug(randDouble());
}

const bc = childProcess.spawn('bc');
let a = new BigFloat();
let b = new BigFloat();

let total = 0;
let bcResult = '';

bc.stdout.on('data', (data: string) => {
	let libResult = a.mul(b).toString(10);
	bcResult += data.toString();

	// If BC output didn't end in a line break or had a continuation backslash
	// before it, then more output is still coming.
	if(!bcResult.match(/[^\\]\n$/)) return;

	++total;
	if(total % 1000 == 0) console.log(total);

	bcResult = BigFloat.trim(bcResult.replace(/\\\n/g, '').trim().toLowerCase().replace(/^(-?)\./, '$10.'));

	if(libResult != bcResult) {
		console.log(a.toString(10) + ' * ' + b.toString(10));
		console.log(a.toString(16) + ' * ' + b.toString(16));
		console.log(a.exponent + ' and ' + b.exponent);
		console.log('BigFloat: ' + a.mul(b).toString(16));
		console.log('BigFloat: ' + libResult);
		// Remove trailing zeroes.
		console.log('bc:       ' + bcResult);
		console.log('');
	}

	bcResult = '';
	if(total < 10000) testMul();
	else bc.stdin.end();
})

bc.stdin.write('scale=1000\n');
//bc.stdin.write('obase=16\n');
//bc.stdin.write('ibase=16\n');

function testMul() {
	a.setDouble(randDouble());
	b.setDouble(randDouble());

//	bc.stdin.write(a.toString(16).toUpperCase() + ' * ' + b.toString(16).toUpperCase() + '\n');
	bc.stdin.write(a.toString(10).toUpperCase() + ' * ' + b.toString(10).toUpperCase() + '\n');
}

testMul();
