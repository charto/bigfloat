// This file is part of bigfloat, copyright (c) 2015- BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { BaseInfo32, limbSize32, limbInv32, limbsPerDigit32 } from './BaseInfo32';
import { BigFloatBase } from './BigFloatBase';
import { trimNumber } from './util';

export class BigFloat32 implements BigFloatBase<BigFloat32> {

	constructor(value?: BigFloat32 | number | string, base?: number) {
		value ? this.setValue(value, base) : this.setZero();
	}

	clone() {
		return(new BigFloat32().setBig(this));
	}

	setZero() {
		this.sign = 1;
		this.fractionLen = 0;
		this.len = 0;

		return(this);
	}

	setValue(other: BigFloat32 | number | string, base?: number) {
		if(typeof(other) == 'number') {
			return(this.setNumber(other));
		}

		if(other instanceof BigFloat32) {
			return(this.setBig(other));
		}

		return(this.setString(other.toString(), base || 10));
	}

	private setBig(other: BigFloat32) {
		const len = other.len;

		this.sign = other.sign;
		this.fractionLen = other.fractionLen;
		this.len = len;

		for(let pos = 0; pos < len; ++pos) {
			this.limbList[pos] = other.limbList[pos];
		}

		return(this);
	}

	/** Set value from a floating point number (probably IEEE 754 double). */

	private setNumber(value: number) {
		if(value < 0) {
			value = -value;
			this.sign = -1;
		} else {
			this.sign = 1;
		}

		let iPart = Math.floor(value);
		let fPart = value - iPart;
		let fractionLen = 0;

		const limbList = this.limbList;
		let limb: number;
		let len = 0;

		// Handle fractional part.
		while(fPart) {
			// Extract limbs starting from the most significant.
			fPart *= limbSize32;
			limb = fPart >>> 0;
			fPart -= limb;

			// Append limb to value (limbs are reversed later).
			limbList[len++] = limb;
			++fractionLen;
		}

		// Reverse array from 0 to len.
		let pos = 0;

		while(--len > pos) {
			limb = limbList[pos];
			limbList[pos++] = limbList[len];
			limbList[len] = limb;
		}

		len += pos + 1;

		// Handle integer part.

		while(iPart) {
			// Extract limbs starting from the least significant.

			limb = iPart % limbSize32; // Could also be iPart >>> 0
			iPart = (iPart - limb) / limbSize32;

			// Append limb to value.
			limbList[len++] = limb;
		}

		this.limbList = limbList;
		this.fractionLen = fractionLen;
		this.len = len;

		return(this);
	}

	private parseFraction(value: string, base: number, start: number, offset: number, limbBase: number, limbDigits: number) {
		const limbList = this.limbList;
		let pos = value.length;

		// Set limbs to zero, because divInt uses them as input.

		let limbNum = offset - 1;

		while(limbNum) {
			limbList[--limbNum] = 0;
		}

		// Read initial digits so their count becomes divisible by limbDigits.

		let posNext = pos - ((pos - start + limbDigits - 1) % limbDigits + 1);

		limbList[offset - 1] = parseInt(value.substr(posNext, pos - posNext), base);
		this.divInt(Math.pow(base, pos - posNext), offset);

		pos = posNext;

		// Read rest of the digits in limbDigits sized chunks.

		while(pos > start) {
			pos -= limbDigits;

			limbList[offset - 1] = parseInt(value.substr(pos, limbDigits), base);

			// Divide by maximum power of base that fits in a limb.
			this.divInt(limbBase, offset);
		}
	}

	private setString(value: string, base: number) {
		const { limbBase, limbDigits, limbDigitsExact } = BaseInfo32.init(base);
		const limbList = this.limbList;
		let pos = -1;
		let c: string;

		this.sign = 1;

		// Handle leading signs and zeroes.

		while(1) {
			c = value.charAt(++pos);

			switch(c) {
				case '-':
					this.sign = -1;
				case '+':
				case '0':
					continue;
			}

			break;
		}

		const posDot = (value.indexOf('.', pos) + 1 || value.length + 1) - 1;

		// Handle fractional part.

		if(posDot < value.length - 1) {
			// Reserve enough limbs to contain digits in fractional part.
			const len = ~~((value.length - posDot - 1) / limbDigitsExact) + 1;

			this.parseFraction(value, base, posDot + 1, len + 1, limbBase, limbDigits);

			this.fractionLen = len;
			this.len = len;

			// Remove trailing zeroes.
			this.trimLeast();
		} else {
			this.fractionLen = 0;
			this.len = 0;
		}

		const offset = this.fractionLen;

		// Handle integer part.

		if(posDot > pos) {
			// Read initial digits so their count becomes divisible by limbDigits.

			let posNext = pos + (posDot - pos + limbDigits - 1) % limbDigits + 1;

			++this.len;
			limbList[offset] = parseInt(value.substr(pos, posNext - pos), base);
			pos = posNext;

			// Read rest of the digits in limbDigits sized chunks.

			while(pos < posDot) {
				// Multiply by maximum power of base that fits in a limb.
				if(this.mulInt(limbBase, limbList, offset, offset, 0)) ++this.len;

				// Add latest limb.
				limbList[offset] += parseInt(value.substr(pos, limbDigits), base);

				pos += limbDigits;
			}
		}

		return(this);
	}

	/** Trim zero limbs from most significant end. */

	private trimMost() {
		const limbList = this.limbList;
		const fractionLen = this.fractionLen;
		let len = this.len;

		while(len > fractionLen && !limbList[len - 1]) --len;

		this.len = len;
	}

	/** Trim zero limbs from least significant end. */

	private trimLeast() {
		const limbList = this.limbList;
		let len = this.fractionLen;
		let pos = 0;

		while(pos < len && !limbList[pos]) ++pos;

		if(pos) this.truncate(len - pos);
	}

	/** Multiply by an integer and write output limbs to another list. */

	private mulInt(factor: number, dstLimbList: number[], srcPos: number, dstPos: number, overwriteMask: number) {
		if(!factor) return(0);

		const limbList = this.limbList;
		const limbCount = this.len;
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
		const lenMultiplier = multiplier.len;
		const productLimbs = product.limbList;

		let posProduct = this.len + lenMultiplier;
		product.len = posProduct;

		// TODO: Only clear from len to len + lenMultiplier
		while(posProduct--) {
			productLimbs[posProduct] = 0;
		}

		this.mulInt(multiplierLimbs[0], productLimbs, 0, 0, 0);

		for(let posMultiplier = 1; posMultiplier < lenMultiplier; ++posMultiplier) {
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
			multiplier = temp32.setNumber(multiplier);
		}

		if(product == this) throw(new Error('Multiplication in place is unsupported'));

		return(this.mulBig(multiplier, product));
	}

	absDeltaFrom(other: number | BigFloat32) {
		if(typeof(other) == 'number') {
			other = temp32.setNumber(other);
		}

		const limbList = this.limbList;
		const otherList = other.limbList;
		let limbCount = this.len;
		let otherCount = other.len;

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
		return(this.len == 0);
	}

	getSign() {
		return(this.len && this.sign);
	}

	/** Return an arbitrary number with sign matching the result of this - other. */

	deltaFrom(other: number | BigFloat32) {
		if(typeof(other) == 'number') {
			other = temp32.setNumber(other);
		}

		return(
			// Make positive and negative zero equal.
			this.len + other.len && (
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

		let lenAddend = addend.len;

		len = augend.len - posAugend;
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
		} else len = augend.len;

		// Copy leftover most significant limbs to output, propagating carry.

		while(posAugend < len) {
			carry += augendLimbs[posAugend++];
			limbSum = carry >>> 0;
			carry = carry - limbSum && 1;

			sumLimbs[posSum++] = limbSum;
		}

		if(carry) sumLimbs[posSum++] = carry;

		sum.len = posSum;
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
		let lenMinuend = minuend.len;
		let lenSubtrahend = subtrahend.len;
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

		difference.len = posDifference;
		difference.trimMost();
		difference.trimLeast();

		return(difference);
	}

	private addSub(addend: number | BigFloat32, sign: -1 | 1, result?: BigFloat32) {
		result = result || new BigFloat32();

		if(result == this) throw(new Error('Addition and subtraction in place is unsupported'));

		if(typeof(addend) == 'number') {
			addend = temp32.setNumber(addend);
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
		const diff = this.fractionLen - fractionLimbCount;

		if(diff > 0) {
			this.fractionLen = fractionLimbCount;
			this.len -= diff;
			const len = this.len;
			const limbList = this.limbList;

			for(let pos = 0; pos < len; ++pos) {
				limbList[pos] = limbList[pos + diff];
			}
		}

		return(this);
	}

	round(decimalCount: number) {
		return(this.truncate(1 + ~~(decimalCount * limbsPerDigit32)));
	}

	/** Divide by integer, replacing current value by quotient. Return integer remainder. */

	private divInt(divisor: number, pos: number) {
		let limbList = this.limbList;
		let limb: number;
		let hi: number, lo: number;
		let carry = 0;

		// If most significant limb is zero after dividing, decrement number of limbs remaining.
		if(limbList[pos - 1] < divisor) {
			carry = limbList[--pos];
			this.len = pos;
		}

		while(pos--) {
			limb = limbList[pos];

			carry = carry * 0x10000 + (limb >>> 16);
			hi = (carry / divisor) >>> 0;
			carry = carry - hi * divisor;

			carry = carry * 0x10000 + (limb & 0xffff);
			lo = (carry / divisor) >>> 0;
			carry = carry - lo * divisor;

			limbList[pos] = ((hi << 16) | lo) >>> 0;
		}

		return(carry);
	}

	private fractionToString(base: number, digitList: string[]) {
		const { pad, limbBase } = BaseInfo32.init(base);
		let limbList = this.limbList;
		let limbCount = this.fractionLen;
		let limbNum = 0;
		let limbStr: string;

		if(base & 1) {
			throw(new Error('Conversion of floating point values to odd bases is unsupported'));
		}

		// Skip least significant limbs that equal zero.
		while(limbNum < limbCount && !limbList[limbNum]) ++limbNum;
		if(limbNum >= limbCount) return;

		digitList.push('.');

		const fPart = temp32;
		fPart.limbList = limbList.slice(limbNum, limbCount);
		fPart.len = limbCount - limbNum;

		limbNum = 0;

		while(limbNum < fPart.len) {
			if(fPart.limbList[limbNum]) {
				let carry = fPart.mulInt(limbBase, fPart.limbList, limbNum, limbNum, 0);

				limbStr = carry.toString(base);

				digitList.push(pad.substr(limbStr.length) + limbStr);
			} else ++limbNum;
		}
	}

	getExpansion(output: number[]) {
		const limbList = this.limbList;
		const len = this.len;
		let exp = this.sign;
		let pos = this.fractionLen;

		while(pos--) {
			exp *= limbInv32;
		}

		while(++pos < len) {
			output[pos] = limbList[pos] * exp;
			exp *= limbSize32;
		}

		return(len);
	}

	valueOf() {
		const limbList = this.limbList;
		let result = 0;
		let exp = limbInv32 * this.sign;
		let len = this.fractionLen;
		let pos = 0;

		while(pos < len) {
			result = result * limbInv32 + limbList[pos++];
		}

		len = this.len;

		while(pos < len) {
			result = result * limbInv32 + limbList[pos++];
			exp *= limbSize32;
		}

		return(result * exp);
	}

	/** Convert to string in any even base supported by Number.toString.
	  * @return String in lower case. */

	toString(base: number = 10) {
		const { pad, limbBase } = BaseInfo32.init(base);
		let digitList: string[] = [];

		let limbList = this.limbList;
		let limb: number;
		let limbStr: string;

		if(limbBase != limbSize32) {
			let iPart = temp32;
			iPart.limbList = limbList.slice(this.fractionLen, this.len);
			iPart.len = this.len - this.fractionLen;

			// Loop while 2 or more limbs remain, requiring arbitrary precision division to extract digits.
			while(iPart.len > 1) {
				limbStr = iPart.divInt(limbBase, iPart.len).toString(base);

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
			let limbNum = this.len;
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

	private sign: -1 | 1;

	/** List of digits in base 2^32, least significant first. */
	private limbList: number[] = [];
	/** Number of limbs belonging to fractional part. */
	private fractionLen: number;
	private len: number;
}

BigFloat32.prototype.cmp = BigFloat32.prototype.deltaFrom;

const temp32 = new BigFloat32();
