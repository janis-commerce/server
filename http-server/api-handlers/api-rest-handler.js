'use strict';

const SchemaValidator = require('@janiscommerce/schema-validator');
const logger = require('@janiscommerce/logger');

const APIHandler = require('./api-handler');

const ServerError = require('./../error');

class APIRestHandler extends APIHandler {

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

			// Add Allow origin
			this.options.cors ? this.corsMiddleware() : null,

			// Schema Validation OpenAPI 3.0 (public.json)
			this.validateSchema.bind(this),

			// Dispatch request
			this.dispatch.bind(this)

		].filter(Boolean);
	}

	static validateSchema(req, res, next) {

		let schemaValidator;

		try {
			schemaValidator = new SchemaValidator(req.path, req.method);
		} catch(err) {
			return ServerError.internalServerError(err, req, res);
		}

		try {
			schemaValidator.validate();
		} catch(err) {
			return ServerError.notFound(req, res, next, err.message);
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

		logger.info(`API View Request: [${req.method}] ${req.originalUrl}`);

		const Dispatcher = this.getDispatcher('rest', req, res);

		const api = new Dispatcher({
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
