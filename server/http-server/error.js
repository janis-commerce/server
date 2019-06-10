'use strict';

const logger = require('@janiscommerce/logger');
const httpCodes = require('./codes');

/**
*	Server Error middlewares
*	@memberof Core
*	@static
*/


class ServerError {

	/**
	*	Not found middleware
	*	@param {object} res - Express response object
	*	@param {object} req - Express request object
	*	@static
	*/
	static notFound(req, res, next, message) {

		message = message || 'Not found';

		logger.error(`${httpCodes.NOT_FOUND} ${message}: ${req.originalUrl} - IP: ${req.ip}`);

		res
			.status(httpCodes.NOT_FOUND)
			.json({
				error: true,
				message
			});
	}

	/**
	*	Handle error middleware
	*	@param {object} err - Error object
	*	@param {object} res - Express response object
	*	@param {object} req - Express request object
	*	@static
	*/
	static handleError(err, req, res, next) { // eslint-disable-line

		if(err)
			logger.error('Middleware', err);

		res
			.status(httpCodes.INTERNAL_ERROR)
			.send({
				message: 'Internal server error',
				error: true
			});
	}


	/**
	*	Handle middleware errors (e.g: BodyParser)
	*	@param {object} err - Error object
	*	@param {object} res - Express response object
	*	@param {object} req - Express request object
	*	@param {function} next - Go to next middleware callback.
	*	@static
	*/

	static middleware(err, req, res, next) {

		// Body parser middleware Error
		if(err instanceof SyntaxError) {

			const message = 'Invalid JSON';

			logger.error(`${message} - ${req.originalUrl}: \n\n${err.stack}`);

			return res
				.status(httpCodes.BAD_REQUEST)
				.send({
					message,
					error: true
				});
		}

		next();
	}

	/**
	*	Internal server error middleware
	*	@param {object} res - Express response object
	*	@param {object} req - Express request object
	*	@static
	*/
	static internalServerError(err, req, res) {

		if(err)
			logger.error(`${httpCodes.INTERNAL_ERROR} Internal Error`, err);

		res
			.status(httpCodes.INTERNAL_ERROR)
			.json({
				error: true,
				message: err && err.message ? err.message : 'Internal server error'
			});
	}

	/**
	*	Bad Request middleware
	*	@param {object} res - Express response object
	*	@param {object} req - Express request object
	*	@static
	*/
	static badRequest(req, res, message) {

		logger.error(`400 Bad Request: ${req.originalUrl} - IP: ${req.ip}`);

		res
			.status(httpCodes.BAD_REQUEST)
			.json({
				error: true,
				message: message || 'Bad request'
			});
	}

}

module.exports = ServerError;
