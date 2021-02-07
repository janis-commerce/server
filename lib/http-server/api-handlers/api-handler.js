'use strict';

const path = require('path');

const logger = require('lllog')();

const ServerError = require('./../error');

const defaultCors = {
	origins: ['*'],
	headers: [
		'authorization',
		'content-type',
		'janis-api-key',
		'janis-api-secret',
		'janis-client',
		'janis-service',
		'janis-entity',
		'x-api-key',
		'x-janis-page',
		'x-janis-page-size'
	],
	allowCredentials: true,
	maxAge: 600
};

class APIHandler {

	static get dispatcherClass() {
		return this._dispatcherClass;
	}

	/**
	 * Handle API Requests
	 */
	static use(app, options) {

		this.options = options;

		this.app = app;

		if(this.options.cors)
			this.corsMiddleware();

		this.app.all(this.routes, this.handler());
	}

	static corsMiddleware() {

		let cors;

		try {
			cors = require(path.join(process.cwd(), 'node_modules', 'cors'));  //eslint-disable-line
		} catch(err) {
			throw new Error('Package \'cors\' not installed. Please run: npm install cors');
		}

		const corsOptions = this.options.cors === true ? defaultCors : this.options.cors;

		this.app.use(cors(corsOptions));
	}

	static async authorizeRequest(req, res, next) {

		const { authorizationClass: AuthClass } = this.options;

		if(AuthClass) {

			try {
				const authInstance = new AuthClass();
				await authInstance.validateRequest(req, res);
			} catch(err) {
				return ServerError.notAuthorize(req, res, err.message);
			}
		}

		next();
	}

	static setDispatcherMiddleware(req, res, next) {

		if(!this._dispatcherClass) {
			try {
				const { Dispatcher } = require(path.join(process.cwd(), 'node_modules', '@janiscommerce/api'));  //eslint-disable-line
				this._dispatcherClass = Dispatcher;
			} catch(err) {
				err.message = 'Package \'@janiscommerce/api\' not installed. Please run: npm install @janiscommerce/api';
				return ServerError.internalServerError(err, req, res);
			}

			if(typeof this._dispatcherClass !== 'function') {
				const message = 'Package \'@janiscommerce/api\' not returning \'Dispatcher\' Class';
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
