// This file is part of bigfloat, copyright (c) 2015- BusFaster Ltd.
// Released under the MIT license, see LICENSE.

/** Base for calculations, the bigger the better but must fit in 32 bits. */
export const limbSize32 = Math.pow(2, 32);
export const limbsPerDigit32 = Math.log(10) / (32 * Math.log(2));

/** Create a string with the given number of zero digits. */

function zeroes(count: number) {
	return(new Array(count + 1).join('0'));
}

export class BaseInfo32 {

	constructor(public base: number) {}

	static init(base: number) {
		return(BaseInfo32.baseTbl[base] || (BaseInfo32.baseTbl[base] = new BaseInfo32(base)));
	}

	private static baseTbl: { [base: number]: BaseInfo32 } = {};

	/** Number of digits per limb, for compatibility in rounding. */
	limbDigits = Math.log(limbSize32) / Math.log(this.base);
	/** Maximum power of base that fits in a limb. */
	limbBase = Math.pow(this.base, ~~this.limbDigits);
	/** String of zeroes for padding an empty limb. */
	pad = zeroes(~~this.limbDigits);

}
