'use strict';

module.exports = app => {
	app.get('/aws/healthcheck', (req, res) => {
		res.end();
	});
};
