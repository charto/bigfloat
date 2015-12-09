System.register(['bigfloat', 'bignumber', 'bigjs'], function(exports_1) {
    var bigfloat_1, bignumber_1, bigjs_1;
    function mandelBig(Num, buf, size, roundingMode) {
        var p = 0;
        for (var py = 0; py < size; ++py) {
            for (var px = 0; px < size; ++px) {
                var x = new Num((px - size / 2) / size * 4);
                var y = new Num((py - size / 2) / size * 4);
                var real = x;
                var imag = y;
                var real2 = real.mul(real);
                var imag2 = imag.mul(imag);
                var threshold = new Num(4);
                var iter = 16;
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
    function mandelNumber(buf, size, sampleCount) {
        var p = 0;
        while (sampleCount--) {
            for (var py = 0; py < size; ++py) {
                for (var px = 0; px < size; ++px) {
                    var x = (px - size / 2) / size * 4;
                    var y = (py - size / 2) / size * 4;
                    var real = 0;
                    var imag = 0;
                    var real2 = real * real;
                    var imag2 = imag * imag;
                    var iter = 16;
                    while (--iter && real2 + imag2 < 4) {
                        imag = real * imag * 2 + y;
                        real = real2 - imag2 + x;
                        real2 = real * real;
                        imag2 = imag * imag;
                    }
                    if (!sampleCount) {
                        buf[p++] = iter * 16;
                        buf[p++] = 0;
                        buf[p++] = 0;
                        buf[p++] = 255;
                    }
                }
            }
        }
    }
    function test(num) {
        var size = 200;
        var gc = document.getElementById('gc').getContext('2d');
        var img = gc.getImageData(0, 0, size, size);
        var buf = img.data;
        var repCount = parseInt(document.getElementById('repeat').value, 10);
        var debug = document.getElementById('debug');
        var timeList = [];
        var sampleCount = 1;
        var timer = setInterval(function () {
            var start = new Date().getTime();
            switch (num) {
                case 1:
                    sampleCount = 100;
                    mandelNumber(buf, size, sampleCount);
                    break;
                case 2:
                    mandelBig(bigfloat_1.BigFloat, buf, size, 0);
                    break;
                case 3:
                    mandelBig(bignumber_1.default, buf, size, 1);
                    break;
                case 4:
                    mandelBig(bigjs_1.default, buf, size, 0);
                    break;
            }
            timeList.push(new Date().getTime() - start);
            gc.putImageData(img, 0, 0);
            debug.value = 'Frames per minute:\n' +
                timeList.map(function (duration) { return ~~(60000 / (duration / sampleCount) + 0.5); }).join(' ');
            if (--repCount <= 0)
                clearInterval(timer);
        }, 200);
    }
    return {
        setters:[
            function (bigfloat_1_1) {
                bigfloat_1 = bigfloat_1_1;
            },
            function (bignumber_1_1) {
                bignumber_1 = bignumber_1_1;
            },
            function (bigjs_1_1) {
                bigjs_1 = bigjs_1_1;
            }],
        execute: function() {
            var _loop_1 = function(num) {
                document.getElementById('test' + num).onclick = function () { test(num); };
            };
            for (var num = 1; num <= 4; ++num) {
                _loop_1(num);
            }
        }
    }
});
