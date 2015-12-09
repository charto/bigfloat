exports.dblEpsilon = Math.pow(2, -52);
var limbSize = Math.pow(2, 32);
var limbDigits = Math.log(limbSize) / Math.LN10;
function zeroes(count) {
    return (new Array(count + 1).join('0'));
}
var BigFloat = (function () {
    function BigFloat(dbl) {
        if (dbl)
            this.setDouble(dbl);
        else {
            this.fractionLen = 0;
            this.limbList = [];
        }
    }
    BigFloat.doubleToString = function (dbl, base) {
        if (base === void 0) { base = 10; }
        var pad = BigFloat.padTbl[base];
        var sign = '';
        var out = '';
        var limb;
        var limbStr;
        var groupSize = limbSize;
        if (isNaN(dbl))
            return ('NaN');
        if (dbl < 0) {
            sign = '-';
            dbl = -dbl;
        }
        if (!isFinite(dbl))
            return (sign + 'Inf');
        if (dbl < 1) {
            out += '0';
        }
        else {
            var iPart = Math.floor(dbl);
            dbl -= iPart;
            if (base == 10)
                groupSize = 1000000000;
            while (iPart) {
                limb = iPart % groupSize;
                iPart = (iPart - limb) / groupSize;
                limbStr = limb.toString(base);
                out = limbStr + out;
                if (iPart)
                    out = pad.substr(limbStr.length) + out;
            }
        }
        if (dbl > 0) {
            out += '.';
            if (base == 10) {
                groupSize = 10;
                pad = '';
            }
            while (dbl) {
                dbl *= groupSize;
                limb = dbl >>> 0;
                dbl -= limb;
                limbStr = limb.toString(base);
                out += pad.substr(limbStr.length) + limbStr;
            }
        }
        return (sign + out.replace(/(\.[0-9a-z]*[1-9a-z])0+$/, '$1'));
    };
    BigFloat.prototype.setDouble = function (dbl) {
        if (dbl < 0) {
            dbl = -dbl;
            this.isNegative = 1;
        }
        else
            this.isNegative = 0;
        var iPart = Math.floor(dbl);
        var fPart = dbl - iPart;
        var fractionLen = 0;
        var limbList = [];
        var limb;
        while (fPart) {
            fPart *= limbSize;
            limb = fPart >>> 0;
            fPart -= limb;
            limbList.push(limb);
            ++fractionLen;
        }
        limbList.reverse();
        while (iPart) {
            limb = iPart % limbSize;
            iPart = (iPart - limb) / limbSize;
            limbList.push(limb);
        }
        this.limbList = limbList;
        this.fractionLen = fractionLen;
        return (this);
    };
    BigFloat.prototype.trimMost = function () {
        var limbList = this.limbList;
        var len = limbList.length;
        var fractionLen = this.fractionLen;
        while (len-- > fractionLen && !limbList[len])
            limbList.pop();
    };
    BigFloat.prototype.trimLeast = function () {
        var limbList = this.limbList;
        var len = this.fractionLen;
        while (len-- && !limbList[0])
            limbList.shift();
        this.fractionLen = len + 1;
    };
    BigFloat.prototype.mulInt = function (factor, dstLimbList, srcPos, dstPos, overwriteMask) {
        if (!factor)
            return (0);
        var limbList = this.limbList;
        var limbCount = limbList.length;
        var limb;
        var lo;
        var carry = 0;
        while (srcPos < limbCount) {
            limb = limbList[srcPos++];
            carry += factor * (limb & 0xffff);
            lo = carry & 0xffff;
            carry = (carry - lo) / 65536;
            carry += factor * (limb >>> 16);
            lo |= carry << 16;
            limb = ((dstLimbList[dstPos] & overwriteMask) + lo) >>> 0;
            dstLimbList[dstPos++] = limb;
            carry = (carry / 65536) >>> 0;
            carry += (lo ^ (((limb - lo) ^ lo) & ~(limb ^ lo))) >>> 31;
        }
        if (carry)
            dstLimbList[dstPos] = carry;
        return (carry);
    };
    BigFloat.prototype.mulBig = function (multiplier) {
        var product = new BigFloat();
        if (this.isZero() || multiplier.isZero())
            return (product);
        var multiplierLimbs = multiplier.limbList;
        var lenMultiplier = multiplierLimbs.length;
        var productLimbs = product.limbList;
        for (var posProduct = this.limbList.length + lenMultiplier; posProduct--;) {
            productLimbs[posProduct] = 0;
        }
        for (var posMultiplier = 0; posMultiplier < lenMultiplier; ++posMultiplier) {
            this.mulInt(multiplierLimbs[posMultiplier], productLimbs, 0, posMultiplier, 0xffffffff);
        }
        product.isNegative = this.isNegative ^ multiplier.isNegative;
        product.fractionLen = this.fractionLen + multiplier.fractionLen;
        product.trimMost();
        product.trimLeast();
        return (product);
    };
    BigFloat.prototype.mul = function (multiplier) {
        if (typeof (multiplier) == 'number') {
            multiplier = BigFloat.tempFloat.setDouble(multiplier);
        }
        return (this.mulBig(multiplier));
    };
    BigFloat.prototype.absDeltaFrom = function (other) {
        if (typeof (other) == 'number') {
            other = BigFloat.tempFloat.setDouble(other);
        }
        var limbList = this.limbList;
        var otherList = other.limbList;
        var limbCount = limbList.length;
        var otherCount = otherList.length;
        var d = (limbCount - this.fractionLen) - (otherCount - other.fractionLen);
        while (!d && limbCount && otherCount)
            d = limbList[--limbCount] - otherList[--otherCount];
        if (d)
            return (d);
        if (limbCount) {
            do
                d = limbList[--limbCount];
            while (!d && limbCount);
        }
        else if (otherCount) {
            do
                d = -otherList[--otherCount];
            while (!d && otherCount);
        }
        return (d);
    };
    BigFloat.prototype.isZero = function () {
        return (this.limbList.length == 0);
    };
    BigFloat.prototype.deltaFrom = function (other) {
        var isNegative = this.isNegative;
        var d = other.isNegative - isNegative;
        if (d) {
            if (this.isZero() && other.isZero())
                return (0);
            return (d);
        }
        if (isNegative) {
            return (-this.absDeltaFrom(other));
        }
        else {
            return (this.absDeltaFrom(other));
        }
    };
    BigFloat.prototype.addBig = function (addend) {
        var augend = this;
        var sum = new BigFloat();
        var fractionLen = augend.fractionLen;
        var len = fractionLen - addend.fractionLen;
        if (len < 0) {
            len = -len;
            fractionLen += len;
            augend = addend;
            addend = this;
        }
        sum.isNegative = this.isNegative;
        sum.fractionLen = fractionLen;
        var sumLimbs = sum.limbList;
        var augendLimbs = augend.limbList;
        var addendLimbs = addend.limbList;
        var posAugend = 0;
        var posAddend = 0;
        var carry = 0;
        var limbSum;
        while (posAugend < len) {
            sumLimbs[posAugend] = augendLimbs[posAugend];
            ++posAugend;
        }
        var lenAddend = addendLimbs.length;
        len = augendLimbs.length - posAugend;
        if (len > lenAddend)
            len = lenAddend;
        while (posAddend < len) {
            carry += augendLimbs[posAugend] + addendLimbs[posAddend++];
            limbSum = carry >>> 0;
            carry = carry - limbSum && 1;
            sumLimbs[posAugend++] = limbSum;
        }
        var posSum = posAugend;
        if (len < lenAddend) {
            len = lenAddend;
            augend = addend;
            posAugend = posAddend;
            augendLimbs = addendLimbs;
        }
        else
            len = augendLimbs.length;
        while (posAugend < len) {
            carry += augendLimbs[posAugend++];
            limbSum = carry >>> 0;
            carry = carry - limbSum && 1;
            sumLimbs[posSum++] = limbSum;
        }
        if (carry)
            sumLimbs[posSum] = carry;
        sum.trimLeast();
        return (sum);
    };
    BigFloat.prototype.subBig = function (subtrahend) {
        var minuend = this;
        var difference = new BigFloat();
        difference.isNegative = this.isNegative;
        if (minuend.absDeltaFrom(subtrahend) < 0) {
            minuend = subtrahend;
            subtrahend = this;
            difference.isNegative ^= 1;
        }
        var fractionLen = minuend.fractionLen;
        var len = fractionLen - subtrahend.fractionLen;
        var differenceLimbs = difference.limbList;
        var minuendLimbs = minuend.limbList;
        var subtrahendLimbs = subtrahend.limbList;
        var lenMinuend = minuendLimbs.length;
        var lenSubtrahend = subtrahendLimbs.length;
        var lenFinal = lenMinuend;
        var posMinuend = 0;
        var posSubtrahend = 0;
        var posDifference = 0;
        var carry = 0;
        var limbDiff;
        if (len >= 0) {
            while (posMinuend < len) {
                differenceLimbs[posMinuend] = minuendLimbs[posMinuend];
                ++posMinuend;
            }
            len += lenSubtrahend;
            if (len > lenMinuend)
                len = lenMinuend;
            posDifference = posMinuend;
        }
        else {
            len = -len;
            fractionLen += len;
            lenFinal += len;
            while (posSubtrahend < len) {
                carry -= subtrahendLimbs[posSubtrahend];
                limbDiff = carry >>> 0;
                carry = -(carry < 0);
                differenceLimbs[posSubtrahend++] = limbDiff;
            }
            len += lenMinuend;
            if (len > lenSubtrahend)
                len = lenSubtrahend;
            posDifference = posSubtrahend;
        }
        difference.fractionLen = fractionLen;
        while (posDifference < len) {
            carry += minuendLimbs[posMinuend++] - subtrahendLimbs[posSubtrahend++];
            limbDiff = carry >>> 0;
            carry = -(carry < 0);
            differenceLimbs[posDifference++] = limbDiff;
        }
        while (posDifference < lenFinal) {
            carry += minuendLimbs[posMinuend++];
            limbDiff = carry >>> 0;
            carry = -(carry < 0);
            differenceLimbs[posDifference++] = limbDiff;
        }
        difference.trimMost();
        difference.trimLeast();
        return (difference);
    };
    BigFloat.prototype.addSub = function (addend, flip) {
        if (typeof (addend) == 'number') {
            addend = BigFloat.tempFloat.setDouble(addend);
        }
        if (this.isNegative ^ addend.isNegative ^ flip) {
            return (this.subBig(addend));
        }
        else {
            return (this.addBig(addend));
        }
    };
    BigFloat.prototype.add = function (addend) {
        return (this.addSub(addend, 0));
    };
    BigFloat.prototype.sub = function (subtrahend) {
        return (this.addSub(subtrahend, 1));
    };
    BigFloat.prototype.truncate = function (fractionLimbCount) {
        if (this.fractionLen > fractionLimbCount) {
            this.limbList = this.limbList.slice(this.fractionLen - fractionLimbCount);
            this.fractionLen = fractionLimbCount;
        }
        return (this);
    };
    BigFloat.prototype.round = function (decimalCount) {
        return (this.truncate(Math.ceil(decimalCount / limbDigits)));
    };
    BigFloat.prototype.divInt = function (divisor) {
        var limbList = this.limbList;
        var limbNum = limbList.length;
        var limb;
        var hi, lo;
        var carry = 0;
        if (limbList[limbNum - 1] < divisor) {
            carry = limbList[--limbNum];
            limbList.length = limbNum;
        }
        while (limbNum--) {
            limb = limbList[limbNum];
            carry = carry * 0x10000 + (limb >>> 16);
            hi = (carry / divisor) >>> 0;
            carry = carry - hi * divisor;
            carry = carry * 0x10000 + (limb & 0xffff);
            lo = (carry / divisor) >>> 0;
            carry = carry - lo * divisor;
            limbList[limbNum] = ((hi << 16) | lo) >>> 0;
        }
        return (carry);
    };
    BigFloat.prototype.fractionToString = function (base, groupSize, digitList) {
        var pad = BigFloat.padTbl[base];
        var limbList = this.limbList;
        var limbCount = this.fractionLen;
        var limbNum = 0;
        var limbStr;
        while (1) {
            if (limbNum >= limbCount)
                return;
            if (limbList[limbNum])
                break;
            ++limbNum;
        }
        digitList.push('.');
        var fPart = BigFloat.tempFloat;
        fPart.limbList = limbList.slice(limbNum, limbCount);
        limbCount -= limbNum;
        limbNum = 0;
        while (1) {
            if (fPart.limbList[limbNum]) {
                var carry = fPart.mulInt(groupSize, fPart.limbList, limbNum, limbNum, 0);
                if (carry)
                    fPart.limbList.pop();
                limbStr = '' + carry;
                digitList.push(pad.substr(limbStr.length) + limbStr);
            }
            else if (++limbNum >= limbCount)
                break;
        }
    };
    BigFloat.prototype.toString = function (base) {
        if (base === void 0) { base = 10; }
        var pad = BigFloat.padTbl[base];
        var digitList = [];
        var limbList = this.limbList;
        var limb;
        var limbStr;
        if (base == 10) {
            var groupSize = 1000000000;
            var iPart = BigFloat.tempFloat;
            iPart.limbList = limbList.slice(this.fractionLen);
            while (iPart.limbList.length) {
                limbStr = '' + iPart.divInt(groupSize);
                digitList.push(pad.substr(limbStr.length) + limbStr);
            }
            digitList.push('' + (iPart.limbList[0] || 0));
            if (this.isNegative)
                digitList.push('-');
            digitList.reverse();
            this.fractionToString(base, groupSize, digitList);
        }
        else {
            var limbNum = limbList.length;
            var fractionPos = this.fractionLen;
            if (this.isNegative)
                digitList.push('-');
            if (limbNum == fractionPos)
                digitList.push('0');
            while (limbNum--) {
                limbStr = limbList[limbNum].toString(base);
                if (limbNum == fractionPos - 1)
                    digitList.push('.');
                digitList.push(pad.substr(limbStr.length) + limbStr);
            }
        }
        return (BigFloat.trim(digitList.join('')));
    };
    BigFloat.trim = function (str) {
        return (str
            .replace(/^(-?)0+([1-9a-z]|0(\.|$))/, '$1$2')
            .replace(/(\.|(\.[0-9a-z]*[1-9a-z]))0+$/, '$2'));
    };
    BigFloat.padTbl = {
        2: zeroes(32),
        10: zeroes(9),
        16: zeroes(8)
    };
    BigFloat.tempFloat = new BigFloat();
    return BigFloat;
})();
exports.BigFloat = BigFloat;
BigFloat.prototype.cmp = BigFloat.prototype.deltaFrom;
