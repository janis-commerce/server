'use strict';

const path = require('path');

const logger = require('@janiscommerce/logger');

const DISPATCHERS = {
	rest: '@janiscommerce/api',
	view: '@janiscommerce/api-view'
};

const ServerError = require('./../error');

class APIHandler {

	static get dispatchers() {
		return DISPATCHERS;
	}

	/**
	 * Handle API Requests
	 *
	 */
	static use(app, options) {
		this.options = options;
		app.all(this.routes, this.handler());
	}

	static getDispatcher(type, req, res) {
		try {
			return require(path.join(process.cwd(), 'node_modules', this.dispatchers[type]));  //eslint-disable-line
		} catch(err) {
			err.message = `Package ${this.dispatchers[type]} not installed.\nPlease run: npm install ${this.dispatchers[type]}`;
			return ServerError.internalServerError(err, req, res);
		}
	}

	static async dispatchApi(api, req, res) {

		let response = await api.dispatch();
		response = typeof response === 'object' ? response : {};

		const body = response.body || {};
		const code = response.code || 200;

		if(response.message)
			body.message = response.message;

		if(code >= 400)
			logger.error(`API Request ${code}: [${req.method}] ${req.originalUrl} - ${body.message || 'internal server error'}`);

		res
			.set(response.headers || {})
			.status(code)
			.json(body);
	}

}

module.exports = APIHandler;
