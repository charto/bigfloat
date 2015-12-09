/** Difference between closest possible IEEE 754 doubles between 1 and 2. */
export const dblEpsilon = Math.pow(2, -52);

/** Base for calculations, the bigger the better but must fit in 32 bits. */
const limbSize = Math.pow(2, 32);

/** Number of decimal digits per limb, for compatibility in rounding. */
const limbDigits = Math.log(limbSize) / Math.LN10;

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
			this.fractionLen = 0;
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
		let fractionLen = 0;

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
			++fractionLen;
		}

		limbList.reverse();

		// Handle integer part.
		while(iPart) {
			// Extract limbs starting from the least significant.
			limb = iPart % limbSize; // Could also be iPart >>> 0
			iPart = (iPart - limb) / limbSize;

			// Append limb to value.
			limbList.push(limb);
		}

		this.limbList = limbList;
		this.fractionLen = fractionLen;

		return(this);
	}

	private trimMost() {
		let limbList = this.limbList;
		let len = limbList.length;
		let fractionLen = this.fractionLen;

		while(len-- > fractionLen && !limbList[len]) limbList.pop();
	}

	private trimLeast() {
		let limbList = this.limbList;
		let len = this.fractionLen;

		while(len-- && !limbList[0]) limbList.shift();

		this.fractionLen = len + 1;
	}

	/** Multiply by an integer and write output limbs to another list. */

	private mulInt(factor: number, dstLimbList: number[], srcPos: number, dstPos: number, overwriteMask: number) {
		if(!factor) return(0);

		let limbList = this.limbList;
		let limbCount = limbList.length;
		var limb: number;
		var lo: number;
		let carry = 0;

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

		// Extend result by one more limb if it overflows.
		if(carry) dstLimbList[dstPos] = carry;

		return(carry);
	}

	private mulBig(multiplier: BigFloat) {
		let product = new BigFloat();

		if(this.isZero() || multiplier.isZero()) return(product);

		let multiplierLimbs = multiplier.limbList;
		const lenMultiplier = multiplierLimbs.length;
		let productLimbs = product.limbList;

		for(let posProduct = this.limbList.length + lenMultiplier; posProduct--;) {
			productLimbs[posProduct] = 0;
		}

		for(let posMultiplier = 0; posMultiplier < lenMultiplier; ++posMultiplier) {
			this.mulInt(multiplierLimbs[posMultiplier], productLimbs, 0, posMultiplier, 0xffffffff);
		}

		product.isNegative = this.isNegative ^ multiplier.isNegative;
		product.fractionLen = this.fractionLen + multiplier.fractionLen;

		product.trimMost();
		product.trimLeast();

		return(product);
	}

	/** Multiply and return product in a new BigFloat. */

	mul(multiplier: number | BigFloat) {
		if(typeof(multiplier) == 'number') {
			multiplier = BigFloat.tempFloat.setDouble(multiplier as number);
		}

		return(this.mulBig(multiplier as BigFloat));
	}

	absDeltaFrom(other: number | BigFloat) {
		if(typeof(other) == 'number') {
			other = BigFloat.tempFloat.setDouble(other as number);
		}

		let limbList = this.limbList;
		let otherList = (other as BigFloat).limbList;
		let limbCount = limbList.length;
		let otherCount = otherList.length;

		// Compare lengths.
		// Note: leading zeroes in integer part must be trimmed for this to work!
		let d = (limbCount - this.fractionLen) - (otherCount - (other as BigFloat).fractionLen);
		// If lengths are equal, compare each limb from most to least significant.
		while(!d && limbCount && otherCount) d = limbList[--limbCount] - otherList[--otherCount];

		if(d) return(d);

		if(limbCount) {
			do d = limbList[--limbCount]; while(!d && limbCount);
		} else if(otherCount) {
			do d = -otherList[--otherCount]; while(!d && otherCount);
		}

		return(d);
	}

	cmp: (other: number | BigFloat) => number;

	isZero() {
		return(this.limbList.length == 0);
	}

	/** Return an arbitrary number with sign matching the result of this - other. */

	deltaFrom(other: BigFloat) {
		let isNegative = this.isNegative;
		let d = other.isNegative - isNegative;

		// Check if signs are different.
		if(d) {
			// Make sure positive and negative zero have no difference.
			if(this.isZero() && other.isZero()) return(0);

			// Return difference of signs.
			return(d);
		}

		if(isNegative) {
			return(-this.absDeltaFrom(other));
		} else {
			return(this.absDeltaFrom(other));
		}
	}

	private addBig(addend: BigFloat) {
		let augend = this as BigFloat;
		let sum = new BigFloat();

		let fractionLen = augend.fractionLen;
		let len = fractionLen - addend.fractionLen;

		if(len < 0) {
			len = -len;
			fractionLen += len;
			augend = addend;
			addend = this;
		}

		sum.isNegative = this.isNegative;
		sum.fractionLen = fractionLen;

		let sumLimbs = sum.limbList;
		let augendLimbs = augend.limbList;
		let addendLimbs = addend.limbList;
		let posAugend = 0;
		let posAddend = 0;
		let carry = 0;
		let limbSum: number;

		// If one input has more fractional limbs, just copy the leftovers to output.

		while(posAugend < len) {
			sumLimbs[posAugend] = augendLimbs[posAugend];
			++posAugend;
		}

		let lenAddend = addendLimbs.length;

		len = augendLimbs.length - posAugend;
		if(len > lenAddend) len = lenAddend;

		// Calculate sum where input numbers overlap.

		while(posAddend < len) {
			carry += augendLimbs[posAugend] + addendLimbs[posAddend++];
			limbSum = carry >>> 0;
			carry = carry - limbSum && 1;

			sumLimbs[posAugend++] = limbSum;
		}

		let posSum = posAugend;

		if(len < lenAddend) {
			len = lenAddend;
			augend = addend;
			posAugend = posAddend;
			augendLimbs = addendLimbs;
		} else len = augendLimbs.length;

		// Copy leftover most significant limbs to output, propagating carry.

		while(posAugend < len) {
			carry += augendLimbs[posAugend++];
			limbSum = carry >>> 0;
			carry = carry - limbSum && 1;

			sumLimbs[posSum++] = limbSum;
		}

		if(carry) sumLimbs[posSum] = carry;

		sum.trimLeast();

		return(sum);
	}

	private subBig(subtrahend: BigFloat) {
		let minuend = this as BigFloat;
		let difference = new BigFloat();

		difference.isNegative = this.isNegative;

		// Make sure the subtrahend is the smaller number.
		if(minuend.absDeltaFrom(subtrahend) < 0) {
			minuend = subtrahend;
			subtrahend = this;
			difference.isNegative ^= 1;
		}

		let fractionLen = minuend.fractionLen;
		let len = fractionLen - subtrahend.fractionLen;

		let differenceLimbs = difference.limbList;
		let minuendLimbs = minuend.limbList;
		let subtrahendLimbs = subtrahend.limbList;
		let lenMinuend = minuendLimbs.length;
		let lenSubtrahend = subtrahendLimbs.length;
		let lenFinal = lenMinuend;
		let posMinuend = 0;
		let posSubtrahend = 0;
		let posDifference = 0;
		let carry = 0;
		let limbDiff: number;

		if(len >= 0) {
			while(posMinuend < len) {
				differenceLimbs[posMinuend] = minuendLimbs[posMinuend];
				++posMinuend;
			}

			len += lenSubtrahend;
			if(len > lenMinuend) len = lenMinuend;

			posDifference = posMinuend;
		} else {
			len = -len;
			fractionLen += len;
			lenFinal += len;

			while(posSubtrahend < len) {
				carry -= subtrahendLimbs[posSubtrahend];
				limbDiff = carry >>> 0;
				carry = -(carry < 0);

				differenceLimbs[posSubtrahend++] = limbDiff;
			}

			len += lenMinuend;
			if(len > lenSubtrahend) len = lenSubtrahend;

			posDifference = posSubtrahend;
		}

		difference.fractionLen = fractionLen;

		// Calculate difference where input numbers overlap.

		while(posDifference < len) {
			carry += minuendLimbs[posMinuend++] - subtrahendLimbs[posSubtrahend++];
			limbDiff = carry >>> 0;
			carry = -(carry < 0);

			differenceLimbs[posDifference++] = limbDiff;
		}

		// Copy leftover most significant limbs to output, propagating carry.

		while(posDifference < lenFinal) {
			carry += minuendLimbs[posMinuend++];
			limbDiff = carry >>> 0;
			carry = -(carry < 0);

			differenceLimbs[posDifference++] = limbDiff;
		}

		difference.trimMost();
		difference.trimLeast();

		return(difference);
	}

	private addSub(addend: number | BigFloat, flip: number) {
		if(typeof(addend) == 'number') {
			addend = BigFloat.tempFloat.setDouble(addend as number);
		}

		if(this.isNegative ^ (addend as BigFloat).isNegative ^ flip) {
			return(this.subBig(addend as BigFloat));
		} else {
			return(this.addBig(addend as BigFloat));
		}
	}

	/** Add and return sum in a new BigFloat. */

	add(addend: number | BigFloat) {
		return(this.addSub(addend, 0));
	}

	/** Subtract and return difference in a new BigFloat. */

	sub(subtrahend: number | BigFloat) {
		return(this.addSub(subtrahend, 1));
	}

	/** Round towards zero, to given number of base 2^32 fractional digits. */

	truncate(fractionLimbCount: number) {
		if(this.fractionLen > fractionLimbCount) {
			this.limbList = this.limbList.slice(this.fractionLen - fractionLimbCount);
			this.fractionLen = fractionLimbCount;
		}

		return(this);
	}

	round(decimalCount: number) {
		return(this.truncate(Math.ceil(decimalCount / limbDigits)));
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

	private fractionToString(base: number, groupSize: number, digitList: string[]) {
		const pad = BigFloat.padTbl[base];
		let limbList = this.limbList;
		let limbCount = this.fractionLen;
		let limbNum = 0;
		let limbStr: string;

		// Skip least significant limbs that equal zero.
		while(1) {
			if(limbNum >= limbCount) return;
			if(limbList[limbNum]) break;
			++limbNum;
		}

		digitList.push('.');

		let fPart = BigFloat.tempFloat;
		fPart.limbList = limbList.slice(limbNum, limbCount);

		limbCount -= limbNum;
		limbNum = 0;

		while(1) {
			if(fPart.limbList[limbNum]) {
				let carry = fPart.mulInt(groupSize, fPart.limbList, limbNum, limbNum, 0);
				if(carry) fPart.limbList.pop();

				limbStr = '' + carry;

				digitList.push(pad.substr(limbStr.length) + limbStr);
			} else if(++limbNum >= limbCount) break;
		}
	}

	/** Convert to string in base 2, 10 or 16. */

	toString(base: number = 10) {
		const pad = BigFloat.padTbl[base];
		let digitList: string[] = [];

		let limbList = this.limbList;
		let limb: number;
		let limbStr: string;

		if(base == 10) {
			const groupSize = 1000000000;
			let iPart = BigFloat.tempFloat;
			iPart.limbList = limbList.slice(this.fractionLen);

			// Loop while 2 or more limbs remain, requiring arbitrary precision division to extract digits.
			while(iPart.limbList.length) {
				limbStr = '' + iPart.divInt(groupSize);

				// Prepend digits into final result, padded with zeroes to 9 digits.
				// Since more limbs still remain, whole result will not have extra padding.
				digitList.push(pad.substr(limbStr.length) + limbStr);
			}

			// Prepend last remaining limb and sign to result.
			digitList.push('' + (iPart.limbList[0] || 0));
			if(this.isNegative) digitList.push('-');

			digitList.reverse();

			// Handle fractional part.

			this.fractionToString(base, groupSize, digitList);
		} else {
			let limbNum = limbList.length;
			let fractionPos = this.fractionLen;

			if(this.isNegative) digitList.push('-');
			if(limbNum == fractionPos) digitList.push('0');

			while(limbNum--) {
				limbStr = limbList[limbNum].toString(base);

				if(limbNum == fractionPos - 1) digitList.push('.');
				digitList.push(pad.substr(limbStr.length) + limbStr);
			}
		}

		// Remove leading and trailing zeroes.
		return(BigFloat.trim(digitList.join('')));
	}

	/** Remove leading and trailing insignificant zero digits. */

	static trim(str: string) {
		return(str
			.replace(/^(-?)0+([1-9a-z]|0(\.|$))/, '$1$2')
			.replace(/(\.|(\.[0-9a-z]*[1-9a-z]))0+$/, '$2')
		);
	}

	private static padTbl: {[base: number]: string} = {
		2: zeroes(32),
		10: zeroes(9),
		16: zeroes(8)
	};

	isNegative: number;
	fractionLen: number;

	private static tempFloat: BigFloat = new BigFloat();

	/** List of digits in base 2^32, least significant first. */
	private limbList: number[];
}

BigFloat.prototype.cmp = BigFloat.prototype.deltaFrom;
