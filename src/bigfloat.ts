/** Difference between closest possible IEEE 754 doubles between 1 and 2. */
export const dblEpsilon = Math.pow(2, -52);

/** Base for calculations, the bigger the better but must fit in 32 bits. */
const limbSize = Math.pow(2, 32);

/** Create a string with the given number of zero digits. */

function zeroes(count: number) {
	return(new Array(count + 1).join('0'));
}

export class BigFloat {

	/** Output EXACT value of an IEEE 754 double in base 2, 10 or 16.
	  * Exponent must be between -2 and 61, and last 3 bits of mantissa must be 0.
	  * Useful for debugging. */

	static doubleToString(dbl: number, base: number = 10) {
		let pad = BigFloat.padTbl[base];
		let sign = '';
		let out = '';
		let limb: number;
		let limbStr: string;
		let groupSize = limbSize

		if(isNaN(dbl)) return('NaN');

		// For negative numbers, output sign and get absolute value.
		if(dbl < 0) {
			sign = '-';
			dbl = -dbl;
		}

		if(!isFinite(dbl)) return(sign + 'Inf');

		if(dbl < 1) {
			out += '0';
		} else {
			let iPart = Math.floor(dbl);
			dbl -= iPart;

			if(base == 10) groupSize = 1000000000;

			while(iPart) {
				// Extract groups of digits starting from the least significant.
				limb = iPart % groupSize;
				iPart = (iPart - limb) / groupSize;
				limbStr = limb.toString(base);

				// Prepend digits to result.
				out = limbStr + out;

				// If more limbs remain, pad with zeroes to group length.
				if(iPart) out = pad.substr(limbStr.length) + out;
			}
		}

		// Is there a fractional part remaining?
		if(dbl > 0) {
			out += '.';

			if(base == 10) {
				groupSize = 10;
				pad = '';
			}

			while(dbl) {
				// Extract groups of digits starting from the most significant.
				dbl *= groupSize;
				limb = dbl >>> 0;
				dbl -= limb;
				limbStr = limb.toString(base);

				// Append digits to result and pad with zeroes to group length.
				out += pad.substr(limbStr.length) + limbStr;
			}
		}

		// Remove trailing zeroes.
		return(sign + out.replace(/(\.[0-9a-z]*[1-9a-z])0+$/, '$1'));
	}

	constructor(dbl?: number) {
		if(dbl) this.setDouble(dbl);
		else {
			this.exponent = 0;
			this.limbList = [];
		}
	}

	/** Set value from a floating point number (probably IEEE 754 double). */

	setDouble(dbl: number) {
		if(dbl < 0) {
			dbl = -dbl;
			this.isNegative = 1;
		} else this.isNegative = 0;

		let iPart = Math.floor(dbl);
		let fPart = dbl - iPart;
		let exponent = 0;

		let limbList: number[] = [];
		let limb: number;

		// Handle fractional part.
		while(fPart) {
			// Extract limbs starting from the most significant.
			fPart *= limbSize;
			limb = fPart >>> 0;
			fPart -= limb;

			// Append limb to value (limbs are reversed later).
			limbList.push(limb);
		}

		limbList.reverse();

		// Handle integer part.
		while(iPart) {
			// Extract limbs starting from the least significant.
			limb = iPart % limbSize; // Could also be iPart >>> 0
			iPart = (iPart - limb) / limbSize;

			// Append limb to value.
			limbList.push(limb);
			++exponent;
		}

		this.limbList = limbList;
		this.exponent = exponent;

		return(this);
	}

	/** Multiply by an integer and write output limbs to another list. */

	private mulInt(factor: number, dstLimbList: number[], srcPos: number, dstPos: number, overwriteMask: number) {
		let limbList = this.limbList;
		let limbCount = limbList.length;
		var limb: number;
		var lo: number;
		let carry = 0;

		if(!factor) return(0);

		// limbList is an array of 32-bit ints but split here into 16-bit low
		// and high words for multiplying by a 32-bit term, so the intermediate
		// 48-bit multiplication results fit into 53 bits of IEEE 754 mantissa.

		while(srcPos < limbCount) {
			limb = limbList[srcPos++];

			// Multiply lower half of limb with factor, making carry temporarily take 48 bits.
			carry += factor * (limb & 0xffff);
			// Get lowest 16 bits of full product.
			lo = carry & 0xffff;
			// Right shift by dividing because >> and >>> truncate to 32 bits before shifting.
			carry = (carry - lo) / 65536;

			// Multiply higher half of limb and combine with lowest 16 bits of full product.
			carry += factor * (limb >>> 16);
			lo |= carry << 16;
			// Lowest 32 bits of full product are added to output limb.
			limb = ((dstLimbList[dstPos] & overwriteMask) + lo) >>> 0;
			dstLimbList[dstPos++] = limb;

			// Highest 32 bits of full product stay in carry, also increment by 1 if previous sum overflowed.
			carry = (carry / 65536) >>> 0;
			// Bit twiddle equivalent to: if(limb < (lo >>> 0)) ++carry;
			carry += (lo ^ (((limb - lo) ^ lo) & ~(limb ^ lo))) >>> 31;
		}

		return(carry);
	}

	/** Divide by integer, replacing current value by quotient. Return integer remainder. */

	private divInt(divisor: number) {
		let limbList = this.limbList;
		let limbNum = limbList.length;
		let limb: number;
		let hi: number, lo: number;
		let carry = 0;

		// If most significant limb is zero after dividing, decrement number of limbs remaining.
		if(limbList[limbNum - 1] < divisor) {
			carry = limbList[--limbNum];
			limbList.length = limbNum;
			--this.exponent;
		}

		while(limbNum--) {
			limb = limbList[limbNum];

			carry = carry * 0x10000 + (limb >>> 16);
			hi = (carry / divisor) >>> 0;
			carry = carry - hi * divisor;

			carry = carry * 0x10000 + (limb & 0xffff);
			lo = (carry / divisor) >>> 0;
			carry = carry - lo * divisor;

			limbList[limbNum] = ((hi << 16) | lo) >>> 0;
		}

		return(carry);
	}

	/** Convert to string in base 2, 10 or 16. */

	toString(base: number = 10) {
		const pad = BigFloat.padTbl[base];
		let digitList: string[] = [];

		let limbList = this.limbList;
		let limbNum = limbList.length;
		let exponent = this.exponent;
		let limb: number;
		let limbStr: string;

		if(base == 10) {
			const groupSize = 1000000000;
			let iPart = BigFloat.tempFloat;
			iPart.limbList = limbList.slice(-exponent || limbList.length);
			iPart.exponent = exponent;

			// Loop while 2 or more limbs remain, requiring arbitrary precision division to extract digits.
			while(iPart.exponent) {
				limbStr = '' + iPart.divInt(groupSize);

				// Prepend digits into final result, padded with zeroes to 9 digits.
				// Since more limbs still remain, whole result will not have extra padding.
				digitList.push(pad.substr(limbStr.length) + limbStr);
			}

			// Prepend last remaining limb and sign to result.
			digitList.push('' + (iPart.limbList[0] || 0));
			if(this.isNegative) digitList.push('-');

			digitList.reverse();

			let fPart = BigFloat.tempFloat;
			fPart.limbList = limbList.slice(0, -exponent || limbList.length);
			fPart.exponent = 0;

			if(fPart.limbList.length) {
				digitList.push('.');

				let offset = 0;

				while(1) {
					// Skip least significant limbs that equal zero.
					if(!fPart.limbList[offset]) {
						if(++offset >= fPart.limbList.length) break;
					} else {
						limbStr = '' + fPart.mulInt(groupSize, fPart.limbList, offset, offset, 0);

						digitList.push(pad.substr(limbStr.length) + limbStr);
					}
				}
			}
		} else {
			let fractionPos = limbNum - exponent - 1;

			if(this.isNegative) digitList.push('-');
			if(exponent == 0) digitList.push('0');

			while(limbNum--) {
				limbStr = limbList[limbNum].toString(base);

				if(limbNum == fractionPos) digitList.push('.');
				digitList.push(pad.substr(limbStr.length) + limbStr);
			}
		}

		// Remove leading and trailing zeroes.
		return(digitList
			.join('')
			.replace(/^(-?)0+([1-9a-z]|0(\.|$))/, '$1$2')
			.replace(/(\.[0-9a-z]*[1-9a-z])0+$/, '$1')
		);
	}

	private static padTbl: {[base: number]: string} = {
		2: zeroes(32),
		10: zeroes(9),
		16: zeroes(8)
	};

	isNegative: number;
	exponent: number;

	private static tempFloat: BigFloat = new BigFloat();

	/** List of digits in base 2^32, least significant first. */
	private limbList: number[];
}
