import { BigFloat32, trimNumber, numberToString } from '..';
import * as childProcess from 'child_process';
import * as fs from 'fs';

const buf = new ArrayBuffer(8);
const charView = new Uint8Array(buf);
const shortView = new Uint16Array(buf);
const doubleView = new Float64Array(buf);

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
	const big = new BigFloat32(dbl);

	const b10a = numberToString(dbl);
	const b10b = big.toString();
	const b16a = numberToString(dbl, 16);
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

interface TestSpec {
	expr: string;
	libResult: string;
};

type Test = () => TestSpec;

const bc = childProcess.spawn('bc');

let testSpec: TestSpec;
let a = new BigFloat32();
let b = new BigFloat32();
let t = new BigFloat32();

let total = 0;
let testNum = 0;
let bcResult = '';

bc.stdout.on('data', (data: string) => {
	bcResult += data.toString();

	// If BC output didn't end in a line break or had a continuation backslash
	// before it, then more output is still coming.
	if(!bcResult.match(/[^\\]\n$/)) return;

	bcResult = trimNumber(bcResult.replace(/\\\n/g, '').trim().toLowerCase().replace(/^(-?)\./, '$10.'));

	if(testSpec.libResult != bcResult) {
		console.log(testSpec.expr);
		console.log('BigFloat: ' + testSpec.libResult);
		console.log('bc:       ' + bcResult);
		console.log('');
	}

	test();
})

function test() {
	++total;
	if(total % 1000 == 0) console.log(total);

	if(total >= 10000) {
		++testNum;
		total = 0;
	}

	if(testList[testNum]) {
		testSpec = testList[testNum]();

		bcResult = '';
		bc.stdin.write(testSpec.expr);
	} else bc.stdin.end();
}

function sign(x: number) {
	return(x > 0 ? 1 : x < 0 ? -1 : 0);
}

let testList: Test[] = [
	() => {
		a.setDouble(randDouble());
		b.setDouble(randDouble());

		return({
			expr: a.toString(10) + ' * ' + b.toString(10) + '\n',
			libResult: a.mul(b, t).toString(10)
		});
	},
	() => {
		a.setDouble(randDouble());
		b.setDouble(randDouble());

		return({
			expr: 'sign(' + a.toString(10) + ' - ' + b.toString(10) + ')\n',
			libResult: '' + sign(a.deltaFrom(b))
		});
	},
	() => {
		a.setDouble(randDouble());
		b.setDouble(randDouble());

		return({
			expr: a.toString(10) + ' + ' + b.toString(10) + '\n',
			libResult: a.add(b, t).toString(10)
		});
	},
	() => {
		a.setDouble(randDouble());
		b.setDouble(randDouble());

		return({
			expr: a.toString(10) + ' - ' + b.toString(10) + '\n',
			libResult: a.sub(b, t).toString(10)
		});
	}
]

console.log('Fuzz-testing...');

bc.stdin.write('define sign(x) {if(x>0) {return(1);} else if(x<0) {return(-1);} else return(0);}');
bc.stdin.write('scale=1000\n');

test();
