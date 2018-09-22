const pkg = require('./package.json');

module.exports = {
	input: pkg.module,
	output: [
		{
			file: pkg.main,
			format: 'cjs'
		}, {
			file: pkg.browser,
			name: pkg.name,
			format: 'umd'
		}
	]
};
