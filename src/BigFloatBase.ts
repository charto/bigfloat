// This file is part of bigfloat, copyright (c) 2018- BusFaster Ltd.
// Released under the MIT license, see LICENSE.

export interface BigFloatBase<Type> {

	setZero(): Type;
	setValue(value: number): Type;
	mul(multiplier: number | Type, product?: Type): Type;
	// absDeltaFrom(other: number | Type): Type;
	cmp(other: number | Type): number;

	isZero(): boolean;
	deltaFrom(other: number | Type): number;
	add(addend: number | Type, sum?: Type): Type;
	sub(subtrahend: number | Type, difference?: Type): Type;
	truncate(fractionLimbCount: number): Type;
	round(decimalCount: number): Type;
	valueOf(): number;
	toString(base: number): string;
}
