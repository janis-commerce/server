'use strict';

const path = require('path');

const logger = require('lllog')();

const DISPATCHERS = {
	rest: '@janiscommerce/api'
};

const ServerError = require('./../error');

class APIHandler {

	static get dispatchers() {
		return DISPATCHERS;
	}

	static get dispatcherClass() {
		return this._dispatcherClass;
	}

	/**
	 * Handle API Requests
	 *
	 */
	static use(app, options) {
		this.options = options;
		app.all(this.routes, this.handler());
	}

	static corsMiddleware(req, res, next) {

		if(this.options.cors) {

			let cors;

			try {
				cors = require(path.join(process.cwd(), 'node_modules', 'cors'));  //eslint-disable-line
			} catch(err) {
				throw new Error('Package \'cors\' not installed. Please run: npm install cors');
			}

			const corsOptions = this.options.cors === true ? {} : this.options.cors;

			cors(corsOptions);
		}

		next();
	}

	static setDispatcherMiddleware(req, res, next) {
		if(!this._dispatcherClass) {
			try {
				const { Dispatcher } = require(path.join(process.cwd(), 'node_modules', this.dispatchers[this.dispatcherType]));  //eslint-disable-line
				this._dispatcherClass = Dispatcher;
			} catch(err) {
				err.message = `Package ${this.dispatchers[this.dispatcherType]} not installed. Please run: npm install ${this.dispatchers[this.dispatcherType]}`;
				return ServerError.internalServerError(err, req, res);
			}

			if(typeof this._dispatcherClass !== 'function') {
				const message = `Package ${this.dispatchers[this.dispatcherType]} not returning 'Dispatcher' Class`;
				return ServerError.internalServerError(new Error(message), req, res);
			}
		}

		next();
	}

	static async dispatchApi(api, req, res) {

		let response = await api.dispatch();
		response = typeof response === 'object' ? response : {};

		const body = response.body || {};
		const code = response.code || 200;

		if(code >= 400) {
			body.error = true;
			logger.error(`API Request ${code}: [${req.method}] ${req.originalUrl} - ${body.message || 'internal server error'}`);
		}

		if(response.message)
			body.message = response.message;

		// TODO set cookies received in response.cookies

		res
			.set(response.headers || {})
			.status(code)
			.json(body);
	}

}

module.exports = APIHandler;
