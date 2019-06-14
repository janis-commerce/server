'use strict';

const express = require('express');
const minimist = require('minimist');

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

const { APIRestHandler, APIViewHandler } = require('./api-handlers');

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
		APIViewHandler.use(this.app, this.options);

		APIRestHandler.use(this.app, this.options);

		// Handle not matching requests - 404
		this.app.use(ServerError.notFound);

		// WARNING: This two middlewares must be called LAST!
		this.app.use(ServerError.handleError);

		this.app.use((req, res, next) => {
			if(!req.timedout)
				next();
		});

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
	*	Start the server
	*
	*/

	async startServer() {

		const server = this.app.listen(this.PORT, () => {
			logger.info(`listening on *:${this.PORT}`);
		});

		// Without this, the server may never close.
		enableShutdown(server);
	}

}

module.exports = HTTPServer;
