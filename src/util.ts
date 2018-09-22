// This file is part of bigfloat, copyright (c) 2015- BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { BaseInfo32, limbSize32 } from './BaseInfo32';

/** Remove leading and trailing insignificant zero digits. */

export function trimNumber(str: string) {
	return(str
		.replace(/^(-?)0+([1-9a-z]|0(\.|$))/, '$1$2')
		.replace(/(\.|(\.[0-9a-z]*[1-9a-z]))0+$/, '$2')
	);
}

/** Output EXACT value of an IEEE 754 double in any base supported by Number.toString.
	 * Exponent must be between -2 and 61, and last 3 bits of mantissa must be 0.
	* Useful for debugging. */

export function numberToString(dbl: number, base = 10) {
	let { pad, limbBase } = BaseInfo32.init(base);
	let sign = '';
	let out = '';
	let limb: number;
	let limbStr: string;

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

		while(iPart) {
			// Extract groups of digits starting from the least significant.
			limb = iPart % limbBase;
			iPart = (iPart - limb) / limbBase;
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

		if(limbBase != limbSize32) {
			limbBase = base;
			pad = '';
		}

		while(dbl) {
			// Extract groups of digits starting from the most significant.
			dbl *= limbBase;
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
