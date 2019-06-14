'use strict';

const logger = require('@janiscommerce/logger');

const APIHandler = require('./api-handler');

class APIViewHandler extends APIHandler {

	static get dispatcherType() {
		return 'view';
	}

	/**
	 * API View Routes
	 * 	endpoints:
	 *			/api/view/:entity/:section/:method/path
	 */
	static get routes() {

		const viewRoutes = '/api/view/:entity/:action/:method';

		return [
			viewRoutes,
			`${viewRoutes}/:entityId`
		];
	}

	static handler() {
		return [

			this.setDispatcherMiddleware.bind(this),

			// Add Allow origin
			this.corsMiddleware.bind(this),

			// Dispatch request
			this.dispatch.bind(this)
		];
	}

	/**
	 * Dispatch an API View
	 *
	 * @param {object} req The express request
	 * @param {object} res The express response
	 */
	static async dispatch(req, res) {

		logger.info(`API View Request: [${req.method}] ${req.originalUrl}`);

		const api = new this.dispatcherClass({ // eslint-disable-line
			entity: req.params.entity,
			action: req.params.action,
			method: req.params.method,
			entityId: req.params.entityId,
			data: req.method === 'GET' ? req.query : req.body,
			headers: req.headers,
			cookies: req.cookies
		});

		await this.dispatchApi(api, req, res);
	}

}

module.exports = APIViewHandler;
