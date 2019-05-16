/*

	@author Fizzmod Backend


	Starts node.js cluster with graceful restart/shutdown.

	Params:

	- options.log                   - function, custom log function, console.log used by default.
	- options.restartOnMemory       - bytes, restart worker on memory usage.
	- options.restartOnTimeout      - ms, restart worker by timer.
	- options.workersCount          - workers count, if not specified `os.cpus().length` will be used.

	Graceful restart performed by USR1 signal:

	pkill -USR1 <cluster_process_name>

	or

	kill -s SIGUSR1 <cluster_pid>


	Gracefull shutdown on SIGINT (pm2 uses this signal on shutdown/restart)

*/

'use strict';

const cluster = require('cluster');

const logger = require('@janiscommerce/logger');

class GracefulCluster {

	constructor() {
		this.restartQueue = [];
		this.killSignalReceived = false;
		this.currentWorkersCount = 0;
		this.listeningWorkersCount = 0;
	}

	start(options) {

		this.options = options;

		if(cluster.isMaster)
			this.startMaster();
		else
			this.startWorker();
	}

	startMaster() {

		const defaultSignal = 'SIGUSR2';

		let SIGUSR = this.options.signal || defaultSignal;

		if(!['SIGUSR1', 'SIGUSR2'].includes(SIGUSR)) {
			logger.warn(`Invalid signal <${SIGUSR}>, using default signal: ${defaultSignal}`);
			SIGUSR = defaultSignal;
		}

		// Fork workers.
		for(let i = 0; i < this.options.workersCount; i++)
			this.fork();

		if(this.options.shouldRestart) {

			// Gracefully shutdown server. pm2-docker sent this signal when `docker stop ${container}` is called.
			// This will allow all pending requests to end.
			process.on('SIGINT', () => {
				logger.warn('MASTER: SIGINT signal received');

				this.killSignalReceived = true;

				Object.values(cluster.workers).forEach(worker => {
					worker.send({
						cmd: 'disconnect'
					});

					worker.disconnect();
				});

			});

			// Gracefuly restart with 'kill -s SIGUSR1 <pid>'.
			process.on(SIGUSR, () => {
				logger.warn(`MASTER: ${SIGUSR} signal received`);

				// Push all workers to restart queue.
				Object.values(cluster.workers)
					.forEach(worker => this.restartQueue.push(worker.process.pid));

				this.checkRestartQueue();
			});
		}

		if(this.options.nodemon) {
			process.once('SIGUSR2', () => {

				logger.warn('MASTER: SIGUSR2 signal received');

				this.killSignalReceived = true;

				// All workers must handle SIGUSR2 and perform: `process.exit()`
				// after that the main process will shutdown
			});
		}

		cluster.on('fork', worker => {
			this.currentWorkersCount++;

			worker.on('listening', () => {
				this.listeningWorkersCount++;
				// New worker online, maybe all online, try restart other.
				this.checkRestartQueue();
			});

			logger.warn(`Cluster: worker #${this.currentWorkersCount} started | PID ${worker.process.pid}.`);
		});

		cluster.on('exit', (worker, code) => {
			this.currentWorkersCount--;
			this.listeningWorkersCount--;

			logger.warn(`Cluster: worker ${worker.process.pid} died (code: ${code}) ${this.killSignalReceived ? '' : 'restarting...'}`);

			// If a restart was requested (Not kill signal received) we fork another worker.

			if(!this.killSignalReceived)
				this.fork();

			// If kill signal was received && currentWorkerCount goes to 0 we exit the process.

			if(this.killSignalReceived && this.currentWorkersCount === 0) {

				logger.warn('All workers are offline, leaving...');

				// Exit main process
				if(this.options.nodemon)
					process.kill(process.pid, 'SIGUSR2');
				else
					process.exit(0);
			}
		});
	}

	startWorker() {

		/**
		*	To avoid downtime, restart on memory/timeout only if we have more than 1 worker.
		*/
		this.options.restartOnMemory = this.options.workersCount > 1 && this.options.restartOnMemory;
		this.options.restartOnTimeout = this.options.workersCount > 1 && this.options.restartOnTimeout;

		// Catch SIGINT for workers, so they won't be closed immediatly.

		if(this.options.shouldRestart)
			process.on('SIGINT', () => {});

		process.on('message', msg => {
			if(msg.cmd === 'disconnect') {
				logger.warn(`disconnecting server ${process.pid}`);

				if(typeof this.options.onDisconnect === 'function')
					this.options.onDisconnect();
			}
		});

		// Self restart logic.
		if(this.options.restartOnMemory) {

			setInterval(() => {
				const mem = process.memoryUsage().rss;

				logger.warn(`memory (${Math.round(mem / (1024 * 1024))} MB)`);

				if(mem > this.options.restartOnMemory) {

					logger.warn(`Cluster: worker ${process.pid} used too much memory (${Math.round(mem / (1024 * 1024))} MB), restarting...`);

					this.gracefullyRestartCurrentWorker();
				}

			}, 5000);
		}

		if(this.options.restartOnTimeout) {

			setInterval(() => {

				logger.warn(`Cluster: worker ${process.pid} restarting by timer...`);
				this.gracefullyRestartCurrentWorker();

			}, this.options.restartOnTimeout);
		}
	}

	// Create fork with 'on restart' message event listener.
	fork() {

		cluster
			.fork()
			.on('message', message => {
				if(message.cmd === 'restart' && message.pid && !this.restartQueue.includes(message.pid)) {

					// When worker asks to restart gracefully in cluster, then add it to restart queue.
					this.restartQueue.push(message.pid);

					this.checkRestartQueue();
				}
			});
	}

	checkRestartQueue() {

		// Kill one worker only if maximum count are working.
		if(this.restartQueue.length && this.listeningWorkersCount === this.options.workersCount) {
			const pid = this.restartQueue.shift();

			let worker;

			Object.values(cluster.workers).forEach(item => {
				if(pid === item.process.pid)
					worker = item;
			});

			try {

				// Send SIGTERM signal to worker. SIGTERM starts graceful shutdown of worker inside it.
				worker.send({ cmd: 'disconnect' });

				worker.disconnect();

				logger.warn('Disconnecting worker!');

			} catch(ex) {

				// Fail silent on 'No such process'. May occur when kill message received after kill initiated but not finished.
				if(ex.code !== 'ESRCH')
					throw ex;
			}
		}
	}

	gracefullyRestartCurrentWorker() {

		// Perform restart by cluster to prevent all workers offline.
		process.send({
			cmd: 'restart',
			pid: process.pid
		});
	}

}

module.exports = new GracefulCluster();
