'use strict';

process.env.UV_THREADPOOL_SIZE = 128;

const path = require('path');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

const minimist = require('minimist');

const logger = require('@janiscommerce/logger');

const GracefulCluster = require('./graceful');

class Server {

	/**
	*	Whether the Environment is production or not.
	*	@private
	*	@return {boolean} True if is production, false other wise
	*/

	static isProduction() {
		return process.env.NODE_ENV === 'production';
	}

	constructor({ cors = true, corsOptions, runProcesses = false } = {}) {

		this.handleGracefulRestart();

		if(cluster.isMaster) {
			if(!this.constructor.isProduction())
				logger.warn('Run with NODE_ENV="production" for better performance!');

			return;
		}

		this.cors = cors;
		this.corsOptions = corsOptions;
		this.runProcesses = runProcesses;

		this.parseArguments();


	}

	/**
	*
	*	Parse cli arguments
	*	@private
	*	@return {void}
	*/

	parseArguments() {

		super.parseArguments();

		const argv = minimist(process.argv.slice(2));

		this.PORT = argv.p || 3001;
		this.WORKERS_COUNT = argv.w || os.cpus().length - 1 || 1;
	}

	/**
	*	Handle graceful restart & fork workers
	*
	*/


	handleGracefulRestart() {

		if(!cluster.isMaster)
			return this.handleWorkerShutdown();

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

			shouldRestart: Server.isProduction(),
			nodemon: !Server.isProduction()
		});
	}

}

module.exports = Server;
