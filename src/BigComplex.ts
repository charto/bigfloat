// This file is part of bigfloat, copyright (c) 2018- BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { BigFloatBase } from './BigFloatBase';
import { BigFloat32 } from './BigFloat32';
import { BigFloat53 } from './BigFloat53';

/** Simpler replacement for the default TypeScript helper.
  * Ignores static members and avoids rollup warnings. */

function __extends<Child, Parent>(child: new(...args: any[]) => Child, parent: new(...args: any[]) => Parent) {
	function helper(this: Parent) { this.constructor = child; }

	(helper as any as new() => Parent).prototype = parent.prototype;
	child.prototype = new (helper as any as new() => Parent)();
}

export class BigComplex<Base extends BigFloatBase<Base>> {

	constructor(
		real?: Base | number,
		imag?: Base | number
	) {
		this.real = typeof(real) == 'object' ? real : new this.Base(real);
		this.imag = typeof(imag) == 'object' ? imag : new this.Base(imag);
	}

	clone() {
		const other = new (this.constructor as new(real: Base, imag: Base) => this)(
			this.real.clone(),
			this.imag.clone()
		);

		return(other);
	}

	setZero() {
		this.real.setZero();
		this.imag.setZero();

		return(this);
	}

	setValue(other: BigComplex<Base>) {
		this.real.setValue(other.real);
		this.imag.setValue(other.imag);

		return(this);
	}

	mul(multiplier: number | Base | BigComplex<Base>, product?: BigComplex<Base>) {
		product = product || new (this.constructor as new() => this)();

		if(multiplier instanceof BigComplex) {
			this.real.mul(multiplier.real, this.temp1);
			this.imag.mul(multiplier.imag, this.temp2);
			this.temp1.sub(this.temp2, product.real);

			this.real.mul(multiplier.imag, this.temp1);
			this.imag.mul(multiplier.real, this.temp2);
			this.temp1.add(this.temp2, product.imag);
		} else {
			this.real.mul(multiplier, product.real);
			this.imag.mul(multiplier, product.imag);
		}

		return(product);
	}

	sqr(product?: BigComplex<Base>) {
		product = product || new (this.constructor as new() => this)();

		this.real.mul(this.real, this.temp1);
		this.imag.mul(this.imag, this.temp2);
		this.temp1.sub(this.temp2, product.real);

		this.real.mul(this.imag, this.temp1);
		this.temp1.add(this.temp1, product.imag);

		return(product);
	}

	add(addend: number | Base | BigComplex<Base>, sum?: BigComplex<Base>) {
		sum = sum || new (this.constructor as new() => this)();

		if(addend instanceof BigComplex) {
			this.real.add(addend.real, sum.real);
			this.imag.add(addend.imag, sum.imag);
		} else {
			this.real.add(addend, sum.real);
		}

		return(sum);
	}

	sub(subtrahend: number | Base | BigComplex<Base>, difference?: BigComplex<Base>) {
		difference = difference || new (this.constructor as new() => this)();

		if(subtrahend instanceof BigComplex) {
			this.real.sub(subtrahend.real, difference.real);
			this.imag.sub(subtrahend.imag, difference.imag);
		} else {
			this.real.sub(subtrahend, difference.real);
		}

		return(difference);
	}

	truncate(fractionLimbCount: number) {
		this.real.truncate(fractionLimbCount);
		this.imag.truncate(fractionLimbCount);

		return(this);
	}

	Base: new(x?: number) => Base;
	real: Base;
	imag: Base;

	temp1: Base;
	temp2: Base;

}

export class BigComplex32 extends BigComplex<BigFloat32> {}
export class BigComplex53 extends BigComplex<BigFloat53> {}

BigComplex32.prototype.Base = BigFloat32;
BigComplex32.prototype.temp1 = new BigFloat32();
BigComplex32.prototype.temp2 = new BigFloat32();

BigComplex53.prototype.Base = BigFloat53;
BigComplex53.prototype.temp1 = new BigFloat53();
BigComplex53.prototype.temp2 = new BigFloat53();
