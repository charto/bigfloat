import {BigFloat} from 'bigfloat'
import BigNumber from 'bignumber'
import Big from 'bigjs'

function mandelBig(Num: any, buf: number[], size: number, roundingMode: number) {
	let p = 0;

	for(let py = 0; py < size; ++py) {
		for(let px = 0; px < size; ++px) {
			let x = new Num((px - size / 2) / size * 4);
			let y = new Num((py - size / 2) / size * 4);

			let real = x;
			let imag = y;
			let real2 = real.mul(real);
			let imag2 = imag.mul(imag);
			let threshold = new Num(4);

			let iter = 16;

			while (--iter && real2.add(imag2).cmp(threshold) < 0) {
				imag = real.mul(imag).round(19, roundingMode);
				imag = imag.add(imag).add(y);
				real = real2.sub(imag2).add(x);

				real2 = real.mul(real).round(19, roundingMode);
				imag2 = imag.mul(imag).round(19, roundingMode);
			}

			buf[p++] = iter * 16;
			buf[p++] = 0;
			buf[p++] = 0;
			buf[p++] = 255;
		}
	}
}

function mandelNumber(buf: number[], size: number, sampleCount: number) {
	let p = 0;

	while(sampleCount--) {
		for(let py = 0; py < size; ++py) {
			for(let px = 0; px < size; ++px) {
				let x = (px - size / 2) / size * 4;
				let y = (py - size / 2) / size * 4;

				let real = 0;
				let imag = 0;
				let real2 = real * real;
				let imag2 = imag * imag;

				let iter = 16;

				while(--iter && real2 + imag2 < 4) {
					imag = real * imag * 2 + y;
					real = real2 - imag2 + x;

					real2 = real * real;
					imag2 = imag * imag;
				}

				if(!sampleCount) {
					buf[p++] = iter * 16;
					buf[p++] = 0;
					buf[p++] = 0;
					buf[p++] = 255;
				}
			}
		}
	}
}

function test(num: number) {
	let size = 200;

	let gc = (document.getElementById('gc') as HTMLCanvasElement).getContext('2d');
	let img = gc.getImageData(0, 0, size, size);
	let buf = img.data;

	let repCount = parseInt((document.getElementById('repeat') as HTMLInputElement).value, 10);
	let debug = document.getElementById('debug') as HTMLTextAreaElement;

	let timeList: number[] = [];
	let sampleCount = 1;

	let timer = setInterval(() => {
		let start = new Date().getTime();

		switch(num) {
			case 1:
				sampleCount = 100;
				mandelNumber(buf, size, sampleCount); break;
			case 2:
				mandelBig(BigFloat, buf, size, 0); break;
			case 3:
				mandelBig(BigNumber, buf, size, 1); break;
			case 4:
				mandelBig(Big, buf, size, 0); break;
		}

		timeList.push(new Date().getTime() - start);

		gc.putImageData(img, 0, 0);
		debug.value = 'Frames per minute:\n' +
			timeList.map((duration: number) => ~~(60000 / (duration / sampleCount) + 0.5)).join(' ');

		if(--repCount <= 0) clearInterval(timer);
	}, 200);
}

for(let num = 1; num <= 4; ++num) {
	document.getElementById('test' + num).onclick = () => {test(num);};
}
