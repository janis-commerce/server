'use strict';

process.env.UV_THREADPOOL_SIZE = 128;

const path = require('path');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

const minimist = require('minimist');

const logger = require('lllog');

const HTTPServer = require('./http-server');
const GracefulCluster = require('./graceful');

class Server {

	/**
	*	Whether the Environment is production or not.
	*	@private
	*	@return {boolean} True if is production, false other wise
	*/

	static get isProduction() {
		return process.env.NODE_ENV === 'production';
	}

	constructor(options) {

		this.parseArguments();

		if(cluster.isMaster) {

			this.handleGracefulRestart();

			if(!this.constructor.isProduction)
				logger.warn('Run with NODE_ENV="production" for better performance!');

			return;
		}

		this.handleWorkerShutdown();

		this.options = options || {};
		this.initialize();
	}

	async initialize() {

		this.handleMessages();

		const httpServer = new HTTPServer(this.options);
		httpServer.start();
	}

	/**
	*
	*	Parse cli arguments
	*	@private
	*	@return {void}
	*/

	parseArguments() {
		const argv = minimist(process.argv.slice(2));
		this.WORKERS_COUNT = argv.w || os.cpus().length - 1 || 1;
	}

	/**
	*	Handle graceful restart & fork workers
	*
	*/


	handleGracefulRestart() {

		const pidFile = path.join(__dirname, '.pid');

		fs.writeFileSync(
			pidFile,
			process.pid
		);

		// PM2 Will send SIGINT signal on restart/reload

		GracefulCluster.start({
			signal: 'SIGUSR2',
			workersCount: this.WORKERS_COUNT,
			restartOnTimeout: false,
			restartOnMemory: false,

			// nodemon restart the process in development, no need for graceful cluster
			// And it will conflict with node debug. SIGUSR1

			shouldRestart: this.constructor.isProduction,
			nodemon: !this.constructor.isProduction
		});
	}

	handleWorkerShutdown() {

		if(!this.constructor.isProduction) {

			// Nodemon kill signal
			process.once('SIGUSR2', () => {
				logger.info('SIGUSR2 received, shutting down gracefully');
				this.shutdown();
			});
		}

	}

	/**
	*	Server shutdown
	*	@private
	*/

	shutdown() {

		logger.info('Shutting down worker');

		process.exit(0); // 0 is without error
	}

	/**
	*	Handle messages from master
	*	@private
	*
	*/

	handleMessages() {

		if(!cluster.isWorker)
			return;

		process.on('message', msg => {

			if(msg.cmd === 'disconnect') {
				logger.warn(`disconnecting server ${process.pid}`);

				this.shutdown();
			}
		});
	}
}

module.exports = Server;
