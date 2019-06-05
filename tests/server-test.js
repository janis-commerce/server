'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');

const sandbox = require('sinon').createSandbox();

const SchemaValidator = require('@janiscommerce/schema-validator');
const API = require('@janiscommerce/api');

const HTTPServer = require('./../server/http-server');

/* eslint-disable prefer-arrow-callback */

describe('HTTPServer', function() {

	let httpServer;

	before(() => {

		httpServer = new HTTPServer();

		chai.use(chaiHttp);

		/*
		 * If port is omitted or is 0, the operating system will assign an arbitrary unused port.
		 * Esto es para que no escuche siempre en el 3001, requerido para cuando se usa el modo watch
		 */
		httpServer.PORT = 0;
		httpServer.start();

	});

	afterEach(() => {
		sandbox.restore();
	});

	it('should end when healthcheck route', function(done) {

		const spyValidator = sandbox.spy(SchemaValidator.prototype, 'validate');
		const spyDispatcher = sandbox.spy(API.prototype, 'dispatch');

		chai
			.request(httpServer.app)
			.get('/aws/healthcheck')
			.end((err, res) => {

				chai.should()
					.not.exist(err);

				chai.expect(res)
					.to.have.status(200);

				chai.expect(res.body)
					.to.be.an('object')
					.to.eql({});

				sandbox.assert.notCalled(spyValidator);

				sandbox.assert.notCalled(spyDispatcher);

				done();
			});
	});

	it('should return 404: not found when validate rejects', function(done) {

		sandbox
			.stub(SchemaValidator.prototype, 'validate')
			.throws('validate error');

		chai
			.request(httpServer.app)
			.get('/api/unknown-endpoint')
			.end((err, res) => {
				chai.should().not.exist(err);
				chai.expect(res).to.have.status(404);
				done();
			});
	});

	it('should dispatch api when validate ok', function(done) {

		sandbox
			.stub(SchemaValidator.prototype, 'validate')
			.returns(true);

		sandbox
			.stub(API.prototype, 'dispatch');

		chai
			.request(httpServer.app)
			.get('/api/unknown-endpoint')
			.end((err, res) => {
				chai.should().not.exist(err);
				chai.expect(res).to.have.status(200);
				done();
			});
	});

});
