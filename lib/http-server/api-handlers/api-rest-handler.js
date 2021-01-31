'use strict';

const path = require('path');

const logger = require('lllog')();

const APIHandler = require('./api-handler');

const ServerError = require('./../error');

class APIRestHandler extends APIHandler {

	static get dispatcherType() {
		return 'rest';
	}

	/**
	 * API Routes
	 * 	endpoints:
	 *			/api/:entity:/:resource:/:sub-entity:/:sub-resource
	 */
	static get routes() {
		return /^\/api((?:\/(?:[a-z-]+)(?:\/(?:[a-f0-9-]+))?)+)$/i;
	}

	static handler() {

		return [

			this.setDispatcherMiddleware.bind(this),

			// Schema Validation OpenAPI 3.0
			this.validateSchemaMiddleware.bind(this),

			// Validate authorization request
			this.authorizeRequest.bind(this),

			// Dispatch request
			this.dispatch.bind(this)
		];
	}

	static get schemaValidator() {

		if(!this._schemaValidator) {
			try {
				this._schemaValidator = require(path.join(process.cwd(), 'node_modules', '@janiscommerce/schema-validator')); // eslint-disable-line
			} catch(err) {
				throw new Error('Package \'SchemaValidator\' not installed. Please run: npm install @janiscommerce/schema-validator');
			}
		}

		return this._schemaValidator;
	}

	static validateSchemaMiddleware(req, res, next) {

		const { validateApiSchemas } = this.options;

		if(typeof validateApiSchemas === 'undefined' || validateApiSchemas !== false) {

			let schemaValidator;

			try {
				schemaValidator = new this.schemaValidator(req.path, req.method); // eslint-disable-line
			} catch(err) {
				return ServerError.internalServerError(err, req, res);
			}

			try {
				schemaValidator.validate();
			} catch(err) {
				res.customError = err.message;
				return ServerError.notFound(req, res);
			}
		}

		next();
	}

	/**
	 * Dispatch an API View
	 *
	 * @param {object} req The express request
	 * @param {object} res The express response
	 */
	static async dispatch(req, res) {

		logger.info(`API Request: [${req.method}] ${req.originalUrl}`);

		const api = new this.dispatcherClass({ // eslint-disable-line
			endpoint: req.params[0],
			method: req.method.toLowerCase(),
			data: req.method === 'GET' ? req.query : req.body,
			headers: req.headers,
			cookies: req.cookies
		});

		await this.dispatchApi(api, req, res);
	}
}

module.exports = APIRestHandler;
