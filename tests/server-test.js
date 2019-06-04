'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');

const HTTPServer = require('./../server/http-server');

/* eslint-disable prefer-arrow-callback */

describe('HTTPServer', function() {

	let httpServer;

	before(() => {

		httpServer = new HTTPServer();

		chai.use(chaiHttp);

		httpServer.start();


	});

	it('something', function(done) {

		chai
			.request(httpServer.app)
			.get('/')
			.end((err, res) => {
				console.log(err);

				done();
			});

	});

});
