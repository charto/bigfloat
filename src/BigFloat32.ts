// This file is part of bigfloat, copyright (c) 2015- BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { BaseInfo32, limbSize32 } from './BaseInfo32';
import { trimNumber } from './util';

export class BigFloat32 {

	constructor(dbl?: number) {
		if(dbl) {
			this.setDouble(dbl);
		} else {
			this.fractionLen = 0;
		}
	}

	setZero() {
		this.sign = 1;
		this.fractionLen = 0;
		this.limbList.length = 0;

		return(this);
	}

	/** Set value from a floating point number (probably IEEE 754 double). */

	setDouble(dbl: number) {
		if(dbl < 0) {
			dbl = -dbl;
			this.sign = -1;
		} else {
			this.sign = 1;
		}

		let iPart = Math.floor(dbl);
		let fPart = dbl - iPart;
		let fractionLen = 0;

		const limbList = this.limbList;
		let limb: number;

		limbList.length = 0;

		// Handle fractional part.
		while(fPart) {
			// Extract limbs starting from the most significant.
			fPart *= limbSize32;
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
			limb = iPart % limbSize32; // Could also be iPart >>> 0
			iPart = (iPart - limb) / limbSize32;

			// Append limb to value.
			limbList.push(limb);
		}

		this.limbList = limbList;
		this.fractionLen = fractionLen;

		return(this);
	}

	/** Trim zero limbs from most significant end. */

	private trimMost() {
		const limbList = this.limbList;
		const fractionLen = this.fractionLen;
		let len = limbList.length;

		while(len-- > fractionLen && !limbList[len]) limbList.pop();
	}

	/** Trim zero limbs from least significant end. */

	private trimLeast() {
		const limbList = this.limbList;
		let len = this.fractionLen;

		while(len-- && !limbList[0]) limbList.shift();

		this.fractionLen = len + 1;
	}

	/** Multiply by an integer and write output limbs to another list. */

	private mulInt(factor: number, dstLimbList: number[], srcPos: number, dstPos: number, overwriteMask: number) {
		if(!factor) return(0);

		const limbList = this.limbList;
		const limbCount = limbList.length;
		let limb: number;
		let lo: number;
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

	private mulBig(multiplier: BigFloat32, product: BigFloat32) {
		if(this.isZero() || multiplier.isZero()) return(product.setZero());

		const multiplierLimbs = multiplier.limbList;
		const lenMultiplier = multiplierLimbs.length;
		const productLimbs = product.limbList;

		let posProduct = this.limbList.length + lenMultiplier;
		productLimbs.length = posProduct;

		while(posProduct--) {
			productLimbs[posProduct] = 0;
		}

		for(let posMultiplier = 0; posMultiplier < lenMultiplier; ++posMultiplier) {
			this.mulInt(multiplierLimbs[posMultiplier], productLimbs, 0, posMultiplier, 0xffffffff);
		}

		product.sign = this.sign * multiplier.sign as (-1 | 1);
		product.fractionLen = this.fractionLen + multiplier.fractionLen;

		product.trimMost();
		product.trimLeast();

		return(product);
	}

	/** Multiply and return product in a new BigFloat32. */

	mul(multiplier: number | BigFloat32, product?: BigFloat32) {
		product = product || new BigFloat32();

		if(typeof(multiplier) == 'number') {
			multiplier = tempFloat.setDouble(multiplier);
		}

		if(product == this) throw(new Error('Cannot multiply in place'));

		return(this.mulBig(multiplier, product));
	}

	absDeltaFrom(other: number | BigFloat32) {
		if(typeof(other) == 'number') {
			other = tempFloat.setDouble(other);
		}

		const limbList = this.limbList;
		const otherList = other.limbList;
		let limbCount = limbList.length;
		let otherCount = otherList.length;

		// Compare lengths.
		// Note: leading zeroes in integer part must be trimmed for this to work!
		let d = (limbCount - this.fractionLen) - (otherCount - other.fractionLen);
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

	cmp: (other: number | BigFloat32) => number;

	isZero() {
		return(this.limbList.length == 0);
	}

	/** Return an arbitrary number with sign matching the result of this - other. */

	deltaFrom(other: number | BigFloat32) {
		if(typeof(other) == 'number') {
			other = tempFloat.setDouble(other);
		}

		return(
			// Make positive and negative zero equal.
			this.limbList.length + other.limbList.length && (
				// Compare signs.
				this.sign - other.sign ||
				// Finally compare full values.
				this.absDeltaFrom(other) * this.sign
			)
		);
	}

	private addBig(addend: BigFloat32, sum: BigFloat32) {
		let augend: BigFloat32 = this;

		let fractionLen = augend.fractionLen;
		let len = fractionLen - addend.fractionLen;

		if(len < 0) {
			len = -len;
			fractionLen += len;
			augend = addend;
			addend = this;
		}

		sum.sign = this.sign;
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

		sumLimbs.length = posSum;

		if(carry) sumLimbs[posSum] = carry;

		sum.trimLeast();

		return(sum);
	}

	private subBig(subtrahend: BigFloat32, difference: BigFloat32) {
		let minuend: BigFloat32 = this;

		difference.sign = this.sign;

		// Make sure the subtrahend is the smaller number.
		if(minuend.absDeltaFrom(subtrahend) < 0) {
			minuend = subtrahend;
			subtrahend = this;
			difference.sign = -this.sign as (-1 | 1);
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
			differenceLimbs.length = lenFinal;

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

			differenceLimbs.length = lenFinal;

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

	private addSub(addend: number | BigFloat32, sign: -1 | 1, result?: BigFloat32) {
		result = result || new BigFloat32();

		if(result == this) throw(new Error('Cannot add or subtract in place'));

		if(typeof(addend) == 'number') {
			addend = tempFloat.setDouble(addend);
		}

		if(this.sign * addend.sign * sign < 0) {
			return(this.subBig(addend, result));
		} else {
			return(this.addBig(addend, result));
		}
	}

	/** Add and return sum in a new BigFloat32. */

	add(addend: number | BigFloat32, sum?: BigFloat32) {
		return(this.addSub(addend, 1, sum));
	}

	/** Subtract and return difference in a new BigFloat32. */

	sub(subtrahend: number | BigFloat32, difference?: BigFloat32) {
		return(this.addSub(subtrahend, -1, difference));
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
		return(this.truncate(Math.ceil(decimalCount / 9)));
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

	private fractionToString(base: number, digitList: string[]) {
		const { pad, limbBase } = BaseInfo32.init(base);
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

		let fPart = tempFloat;
		fPart.limbList = limbList.slice(limbNum, limbCount);

		limbCount -= limbNum;
		limbNum = 0;

		while(1) {
			if(fPart.limbList[limbNum]) {
				let carry = fPart.mulInt(limbBase, fPart.limbList, limbNum, limbNum, 0);
				if(carry) fPart.limbList.pop();

				limbStr = carry.toString(base);

				digitList.push(pad.substr(limbStr.length) + limbStr);
			} else if(++limbNum >= limbCount) break;
		}
	}

	/** Convert to string in any base supported by Number.toString. */

	toString(base: number = 10) {
		const { pad, limbBase } = BaseInfo32.init(base);
		let digitList: string[] = [];

		let limbList = this.limbList;
		let limb: number;
		let limbStr: string;

		if(limbBase != limbSize32) {
			let iPart = tempFloat;
			iPart.limbList = limbList.slice(this.fractionLen);

			// Loop while 2 or more limbs remain, requiring arbitrary precision division to extract digits.
			while(iPart.limbList.length) {
				limbStr = iPart.divInt(limbBase).toString(base);

				// Prepend digits into final result, padded with zeroes to 9 digits.
				// Since more limbs still remain, whole result will not have extra padding.
				digitList.push(pad.substr(limbStr.length) + limbStr);
			}

			// Prepend last remaining limb and sign to result.
			digitList.push('' + (iPart.limbList[0] || 0));
			if(this.sign < 0) digitList.push('-');

			digitList.reverse();

			// Handle fractional part.

			this.fractionToString(base, digitList);
		} else {
			let limbNum = limbList.length;
			const fractionPos = this.fractionLen;

			if(this.sign < 0) digitList.push('-');
			if(limbNum == fractionPos) digitList.push('0');

			while(limbNum--) {
				limbStr = limbList[limbNum].toString(base);

				if(limbNum == fractionPos - 1) digitList.push('.');
				digitList.push(pad.substr(limbStr.length) + limbStr);
			}
		}

		// Remove leading and trailing zeroes.
		return(trimNumber(digitList.join('')));
	}

	sign: -1 | 1 = 1;

	/** List of digits in base 2^32, least significant first. */
	private limbList: number[] = [];
	/** Number of limbs belonging to fractional part. */
	private fractionLen: number;
}

BigFloat32.prototype.cmp = BigFloat32.prototype.deltaFrom;

const tempFloat = new BigFloat32();
