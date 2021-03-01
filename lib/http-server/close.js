'use strict';

/**
*	@author Fizzmod Backend
*
*	Handle server shutdown, correctly handling keep alive connections,
*	and destroying sockets when the server close is called, otherwise the server may never be closed.
*
*/
function enableShutdown(server) {

	let shutdownRequested = false;

	server.on('request', (request, response) => {

		if(shutdownRequested && !response.headersSent)
			response.setHeader('Connection', 'close'); // Override keep alive

		/**
		 *	If server is closed, destroy socket when the request is finished (AKA close keep alived socket)
		 */
		response.on('finish', () => {
			if(shutdownRequested)
				request.socket.destroy();

		});
	});

	server.shutdown = callback => {

		shutdownRequested = true;

		server.close(err => {
			if(callback) {
				process.nextTick(() => {
					callback(err);
				});
			}
		});
	};
}


module.exports = enableShutdown;
