'use strict';

const express = require('express');
const minimist = require('minimist');

//

const SchemaValidator = require('@janiscommerce/schema-validator');
const API = require('@janiscommerce/api');
// const APIView = require('@janiscommerce/api-view');
const logger = require('@janiscommerce/logger');

/**
* 	Middlewares
*/
const timeout = require('connect-timeout');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

//

const ServerError = require('./error');
const enableShutdown = require('./close');

class HTTPServer {

	/**
	*	Whether the Environment is production or not.
	*	@private
	*	@return {boolean} True if is production, false other wise
	*/

	static get isProduction() {
		return process.env.NODE_ENV === 'production';
	}

	/**
	*	Whether the Environment is develop or not.
	*	@private
	*	@return {boolean} True if is develop, false other wise
	*/

	static get isDevelop() {
		return process.env.NODE_ENV === 'dev';
	}

	constructor(options) {
		this.options = options || {};
		this.parseArguments();
	}

	/**
	*
	*	Parse cli arguments
	*	@private
	*	@return {void}
	*/

	parseArguments() {
		const argv = minimist(process.argv.slice(2));
		this.PORT = argv.p || 3001;
	}

	start() {

		this.app = express();

		this.app.enable('trust proxy'); // Without this BruteForoce && enforceSSL middlewares fail due to AWS Load Balancer.

		// Use middlewares: timeout, compression, etc etc
		this.useMiddlewares();

		// Handle middleware errors. E.g body parser error.
		this.app.use(ServerError.middleware);

		// must be first than api requests because /api/view/... is more especifica than /api/...
		this.handleAPIViewRequests();

		this.handleAPIRequests();

		// Handle not matching requests - 404
		this.app.use(ServerError.notFound);

		// WARNING: This two middlewares must be called LAST!
		this.app.use(ServerError.handleError);

		return this.startServer();
	}

	/**
	*	Setup/Use express middlewares
	*
	*/

	useMiddlewares() {

		// Enfroce SSL
		this.enforceSSL();

		// this.app.disable('etag'); // Disable browser cache...

		this.app.use(helmet()); // A little security...

		this.app.use(timeout('60s')); // Timeout

		// for parsing application/json
		this.app.use(express.json({
			limit: '2mb'
		}));

		// for parsing application/x-www-form-urlencoded
		this.app.use(express.urlencoded({
			extended: true
		}));

		this.app.use(compression()); // gzip compression

		this.app.use(cookieParser()); // Cookies
	}

	/**
	*	Enforce SSL.
	*/

	enforceSSL() {

		if(!this.shouldEnforceSSL())
			return;

		this.app.set('forceSSLOptions', {
			enable301Redirects: true,
			trustXFPHeader: true, // To trust AWS LB
			httpsPort: 443,
			sslRequiredMessage: 'HTTPS Required.'
		});

		this.app.use((req, res, next) => {

			if(!this.constructor.isProduction || this.constructor.isDevelop)
				return next();

			/* eslint-disable global-require */
			const enforceSSL = require('express-force-ssl');
			/* eslint-enable global-require */

			return enforceSSL(req, res, next);
		});
	}

	shouldEnforceSSL() {
		return typeof this.options.shouldEnforceSSL === 'undefined' || !!this.options.shouldEnforceSSL;
	}

	/**
	 * Handle API View Requests
	 * 	endpoints:
	 *			/api/view/:entity/:section/:method/path
	 */
	handleAPIViewRequests() {
		const viewRoutes = '/api/view/:entity/:action/:method';
		this.app.all([viewRoutes, `${viewRoutes}/:entityId`], this.APIViewHandler());
	}

	APIViewHandler() {
		return [
			// Add Allow origin
			this.options.cors ? this.corsMiddleware() : null,

			// Dispatch request
			this.dispatchView.bind(this)
		].filter(Boolean);
	}

	/**
	 * Dispatch an API View
	 *
	 * @param {Function} APIHandler The api handler
	 */

	async dispatchView(req, res) {

		logger.info(`VIEW Request: [${req.method}] ${req.originalUrl}`);

		console.log(req.params);

		const api = new API({
			endpoint: req.params[0],
			method: req.method.toLowerCase(),
			data: req.method === 'GET' ? req.query : req.body,
			headers: req.headers,
			cookies: req.cookies
		});

		let result = await api.dispatch();
		result = typeof result === 'object' && !Array.isArray(result) ? result : {};

		res
			.set(result.headers || {})
			.status(result.code || 200)
			.json(result.body || {});
	}

	/**
	*	Handle API request.
	*/
	handleAPIRequests() {
		const apiRoutes = /^\/api((?:\/(?:[a-z-]+)(?:\/(?:[a-f0-9-]+))?)+)$/i;
		this.app.all(apiRoutes, this.APIHandler());
	}

	/**
	 *	API middleares
	 *
	 */
	APIHandler() {
		return [

			// Add Allow origin
			this.options.cors ? this.corsMiddleware() : null,

			// Schema Validation OpenAPI 3.0 (public.json)
			// this.validateSchema.bind(this),

			// Dispatch request
			this.dispatch.bind(this)

		].filter(Boolean);
	}

	validateSchema(req, res, next) {

		let schemaValidator;

		try {
			schemaValidator = new SchemaValidator(req.path, req.method);
		} catch(error) {
			return ServerError.internalServerError(error, req, res);
		}

		try {
			schemaValidator.validate();
		} catch(error) {
			return ServerError.notFound(req, res, error.message);
		}

		next();
	}

	corsMiddleware() {

		/* eslint-disable global-require */
		const cors = require('cors');
		/* eslint-enable global-require */
		cors(this.options.corsOptions);

		return null;
	}

	/**
	 * Dispatch an API
	 *
	 * @param {object} req The express request
	 * @param {object} res The express response
	 */

	async dispatch(req, res) {

		logger.info(`Request: [${req.method}] ${req.originalUrl}`);

		console.log(req.params);

		const api = new API({
			endpoint: req.params[0],
			method: req.method.toLowerCase(),
			data: req.method === 'GET' ? req.query : req.body,
			headers: req.headers,
			cookies: req.cookies
		});

		let result = await api.dispatch();
		result = typeof result === 'object' && !Array.isArray(result) ? result : {};

		res
			.set(result.headers || {})
			.status(result.code || 200)
			.json(result.body || {});
	}

	/**
	*	Start the server
	*
	*/

	async startServer() {

		const server = this.app.listen(this.PORT, () => {
			logger.info(`listening on *:${this.PORT}`);
		});

		// await this.setupSocket(server);

		// Without this, the server may never close.
		enableShutdown(server);
	}

}

module.exports = HTTPServer;
